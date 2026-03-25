import { NextRequest } from "next/server";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acquireWidgetSessionTurnLock,
  buildDraftWidgetRuntimeAgents,
  buildWidgetRuntimeCorsHeaders,
  buildStoredWidgetRuntimeAgents,
  completeWidgetSession,
  getPublishedAgentVersion,
  getWidgetRuntimeAgent,
  handleConversationCompleted,
  insertWidgetMessages,
  loadOrderedWidgetSessionHistory,
  loadWidgetByPublicKey,
  loadWidgetSession,
  releaseWidgetSessionTurnLock,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type RuntimeWidgetAgentSelection,
  type WidgetAdminSupabase,
  upsertWidgetSession,
} from "@/lib/widgets/server";

function sseChunk(payload: Record<string, unknown>) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
) {
  return Response.json(
    code ? { error, code } : { error },
    { status, headers: buildWidgetRuntimeCorsHeaders(request) },
  );
}

const SESSION_BUSY_ERROR =
  "Another reply is already being generated for this chat. Please wait for the current response to finish.";

function resolveSelectedWidgetAgent(args: {
  widgetAgents: RuntimeWidgetAgentSelection[];
  activeWidgetAgentId: string | null;
  activeAgentId: string | null;
  requestedWidgetAgentId: string | null;
}) {
  const {
    widgetAgents,
    activeWidgetAgentId,
    activeAgentId,
    requestedWidgetAgentId,
  } = args;

  if (widgetAgents.length === 0) {
    return {
      error: "This widget has no attached agents yet.",
      status: 400,
      code: "NO_WIDGET_AGENTS",
    } as const;
  }

  const selectedFromSession = activeWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === activeWidgetAgentId) ?? null
    : null;

  const selectedFromAgentSession =
    !selectedFromSession && activeAgentId
      ? widgetAgents.find((item) => item.agent.id === activeAgentId) ?? null
      : null;

  if (activeWidgetAgentId && !selectedFromSession && !selectedFromAgentSession) {
    return {
      error: "This conversation is bound to an agent that is no longer attached. Start a new chat.",
      status: 409,
      code: "SESSION_AGENT_INVALID",
    } as const;
  }

  const selectedFromRequest = requestedWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === requestedWidgetAgentId) ?? null
    : null;

  if (requestedWidgetAgentId && !selectedFromRequest) {
    return {
      error: "The selected widget agent is not attached to this widget.",
      status: 400,
      code: "INVALID_WIDGET_AGENT",
    } as const;
  }

  const lockedSelection = selectedFromSession ?? selectedFromAgentSession;

  if (lockedSelection) {
    if (
      selectedFromRequest &&
      selectedFromRequest.widgetAgentId !== lockedSelection.widgetAgentId
    ) {
      return {
        error: "Switching agent requires a new session.",
        status: 409,
        code: "AGENT_SWITCH_REQUIRES_NEW_SESSION",
      } as const;
    }

    return { selected: lockedSelection } as const;
  }

  if (widgetAgents.length === 1) {
    return { selected: widgetAgents[0] } as const;
  }

  if (selectedFromRequest) {
    return { selected: selectedFromRequest } as const;
  }

  return {
    error: "widgetAgentId is required when multiple agents are attached.",
    status: 400,
    code: "WIDGET_AGENT_REQUIRED",
  } as const;
}

export async function OPTIONS(request: NextRequest) {
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  if (!runtimeOrigin.ok) {
    return buildErrorResponse(
      request,
      runtimeOrigin.status,
      runtimeOrigin.error,
      runtimeOrigin.code,
    );
  }

  return new Response(null, {
    status: 204,
    headers: buildWidgetRuntimeCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);
  let turnRequestId: string | null = null;
  let turnLockHeld = false;
  let turnLockWidgetId: string | null = null;
  let turnLockSessionId: string | null = null;

  async function releaseTurnLock(widgetId: string, sessionId: string) {
    if (!turnRequestId || !turnLockHeld) {
      return;
    }

    try {
      await releaseWidgetSessionTurnLock(supabase, {
        widgetId,
        sessionId,
        requestId: turnRequestId,
      });
    } catch (error) {
      console.error("Failed to release widget turn lock:", error);
    } finally {
      turnLockHeld = false;
    }
  }

  try {
    if (!runtimeOrigin.ok) {
      return buildErrorResponse(
        request,
        runtimeOrigin.status,
        runtimeOrigin.error,
        runtimeOrigin.code,
      );
    }

    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      loaded.widget,
      request,
    );

    const access = await resolveWidgetRuntimeAccess({
      request,
      widget: loaded.widget,
      preview,
    });

    if (!access.ok) {
      return buildErrorResponse(
        request,
        access.status,
        access.error,
        access.code,
      );
    }

    if (access.source !== "preview" && loaded.widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.sessionId ?? "").trim();
    const message = String(body.message ?? "").trim();
    const requestedWidgetAgentId = String(body.widgetAgentId ?? "").trim() || null;
    const pageUrl = String(body.pageUrl ?? "").trim() || null;
    const referrer = String(body.referrer ?? "").trim() || null;

    if (!sessionId || !message) {
      return buildErrorResponse(
        request,
        400,
        "sessionId and message are required.",
      );
    }

    const existingSession = await loadWidgetSession(
      supabase,
      loaded.widget.id,
      sessionId,
    );

    if (existingSession?.status === "completed") {
      return buildErrorResponse(
        request,
        409,
        "This chat has already ended. Start a new chat to continue.",
        "SESSION_COMPLETED",
      );
    }

    const runtimeWidgetAgents = preview.previewDraft
      ? await buildDraftWidgetRuntimeAgents(
          supabase,
          loaded.widget,
          preview.previewDraft.payload,
        )
      : buildStoredWidgetRuntimeAgents(loaded.widgetAgents);
    const selection = resolveSelectedWidgetAgent({
      widgetAgents: runtimeWidgetAgents,
      activeWidgetAgentId: existingSession?.active_widget_agent_id ?? null,
      activeAgentId: existingSession?.active_agent_id ?? null,
      requestedWidgetAgentId,
    });

    if (!("selected" in selection)) {
      return buildErrorResponse(
        request,
        selection.status,
        selection.error,
        selection.code,
      );
    }

    const selected = selection.selected;
    const selectedVersionId = preview.isPreview
      ? selected!.publishedVersionId ?? selected!.agent.published_version_id
      : selected!.publishedVersionId;

    if (!selectedVersionId && !preview.isPreview) {
      return buildErrorResponse(
        request,
        409,
        "This agent is not deployed for the widget.",
        "WIDGET_AGENT_NOT_DEPLOYED",
      );
    }

    const widgetSession = await upsertWidgetSession(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      source: access.source,
      pageUrl,
      referrer,
      origin: access.origin,
      activeWidgetAgentId: selected!.persistedWidgetAgentId,
      activeAgentId: selected!.agent.id,
    });

    turnRequestId = crypto.randomUUID();
    turnLockWidgetId = loaded.widget.id;
    turnLockSessionId = sessionId;
    const turnLock = await acquireWidgetSessionTurnLock(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      requestId: turnRequestId,
    });

    if (!turnLock.acquired) {
      if (turnLock.sessionStatus === "completed") {
        return buildErrorResponse(
          request,
          409,
          "This chat has already ended. Start a new chat to continue.",
          "SESSION_COMPLETED",
        );
      }

      return buildErrorResponse(
        request,
        409,
        SESSION_BUSY_ERROR,
        "SESSION_BUSY",
      );
    }

    turnLockHeld = true;

    const userMessageTimestamp = new Date().toISOString();
    await upsertWidgetSession(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      source: widgetSession.source,
      pageUrl: widgetSession.page_url,
      referrer: widgetSession.referrer,
      origin: widgetSession.origin,
      activeWidgetAgentId: widgetSession.active_widget_agent_id,
      activeAgentId: widgetSession.active_agent_id,
      lastUserMessageAt: userMessageTimestamp,
    });

    await insertWidgetMessages(supabase, {
      widgetSessionId: widgetSession.id,
      widgetId: loaded.widget.id,
      widgetAgentId: selected!.persistedWidgetAgentId,
      agentId: selected!.agent.id,
      messages: [{ role: "user", content: message }],
    });

    const history = await loadOrderedWidgetSessionHistory(
      supabase,
      widgetSession.id,
    );

    const publishedVersion = await getPublishedAgentVersion(
      supabase,
      selectedVersionId,
    );
    const runtimeAgent = getWidgetRuntimeAgent(selected!.agent, publishedVersion);
    const previewRuntimeAgent = preview.runtimeConfig?.agents.find(
      (agentConfig) => agentConfig.agentId === selected!.agent.id,
    );
    const endChatPolicy = preview.isPreview
      ? previewRuntimeAgent?.endChatPolicy ??
        extractEndChatPolicyFromDefinition(publishedVersion?.definition)
      : extractEndChatPolicyFromDefinition(publishedVersion?.definition);
    const gmailRecipientPolicy = preview.isPreview
      ? previewRuntimeAgent?.gmailRecipientPolicy ??
        extractGmailRecipientPolicyFromDefinition(publishedVersion?.definition)
      : extractGmailRecipientPolicyFromDefinition(publishedVersion?.definition);
    const googleCalendarSelection = preview.isPreview
      ? previewRuntimeAgent?.googleCalendarSelection ??
        extractGoogleCalendarSelectionFromDefinition(publishedVersion?.definition)
      : extractGoogleCalendarSelectionFromDefinition(publishedVersion?.definition);

    const calendarTimezone = googleCalendarSelection.timezone;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await runAgentChat({
            supabase: supabase as never,
            agent: runtimeAgent,
            input: message,
            history: history.map((item) => ({
              role:
                item.role === "assistant"
                  ? "assistant"
                  : item.role === "tool"
                    ? "tool"
                    : "user",
              content: item.content,
              tool_call_id:
                typeof item.metadata?.tool_call_id === "string"
                  ? item.metadata.tool_call_id
                  : null,
            })),
            toolUserId: selected!.agent.created_by,
            audience: "widget",
            widgetPublicKey: loaded.widget.widget_public_key,
            calendarTimezone,
            googleCalendarSelection,
            endChatPolicy,
            gmailRecipientPolicy,
            onToken: (() => {
              let cumulativeContent = "";
              return (token: string) => {
                cumulativeContent += token;
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(sseChunk({ content: cumulativeContent })));
              };
            })(),
            onStatus: (statusMessage) => {
              // Optionally emit status updates as specialized chunks, or simple debug info
              // Let's send a status chunk so frontend could handle 'searching...'
              const encoder = new TextEncoder();
              // Example payload frontend can parse if they want
              controller.enqueue(encoder.encode(sseChunk({ status: statusMessage })));
            }
          });
          const assistantMessageTimestamp = new Date().toISOString();

          await insertWidgetMessages(supabase, {
            widgetSessionId: widgetSession.id,
            widgetId: loaded.widget.id,
            widgetAgentId: selected!.persistedWidgetAgentId,
            agentId: selected!.agent.id,
            messages: [
              ...result.toolMessages.map((toolMessage) => ({
                role: "tool" as const,
                content: String(toolMessage.content ?? ""),
                metadata: toolMessage,
              })),
              {
                role: "assistant" as const,
                content: result.assistantContent,
                metadata: {
                  ...result.assistantMetadata,
                  ...(result.debugTrace ? { debugTrace: result.debugTrace } : {})
                },
              },
            ],
          });

          let completedSession = await upsertWidgetSession(supabase, {
            widgetId: loaded.widget.id,
            sessionId,
            source: widgetSession.source,
            pageUrl: widgetSession.page_url,
            referrer: widgetSession.referrer,
            origin: widgetSession.origin,
            activeWidgetAgentId: widgetSession.active_widget_agent_id,
            activeAgentId: widgetSession.active_agent_id,
            lastAssistantMessageAt: assistantMessageTimestamp,
          });

          if (result.endChat?.sessionCompleted) {
            completedSession = await completeWidgetSession(supabase, {
              session: completedSession,
              reason: result.endChat.reason ?? "assistant_suggestion",
              completedAt: assistantMessageTimestamp,
              lastAssistantMessageAt: assistantMessageTimestamp,
            });
            await handleConversationCompleted({
              widget: loaded.widget,
              session: completedSession,
              reason: completedSession.end_reason ?? "assistant_suggestion",
            });
            controller.enqueue(
              new TextEncoder().encode(
                sseChunk({
                  sessionCompleted: true,
                  endReason: completedSession.end_reason,
                }),
              ),
            );
          }

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        } catch (error) {
          console.error("Stream generation error:", error);
          const message =
            error instanceof Error ? error.message : "Stream error occurred.";
          controller.enqueue(
            new TextEncoder().encode(
              sseChunk({ error: message, terminal: true }),
            ),
          );
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        } finally {
          await releaseTurnLock(loaded.widget.id, sessionId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...buildWidgetRuntimeCorsHeaders(request),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (turnLockWidgetId && turnLockSessionId) {
      await releaseTurnLock(turnLockWidgetId, turnLockSessionId);
    }

    return buildErrorResponse(
      request,
      500,
      error instanceof Error ? error.message : "Failed to run widget chat.",
    );
  }
}
