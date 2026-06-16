import { NextRequest } from "next/server";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  buildPersistedAssistantMetadata,
  buildPersistedToolMessages,
} from "@/lib/debug-trace-security";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { extractCalSelectionFromDefinition } from "@/lib/cal";
import {
  consumeWorkspaceMessageUsage,
  MessageLimitExceededError,
} from "@/lib/message-usage";
import {
  buildPublicWidgetRateLimitContext,
  buildRateLimitErrorPayload,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
} from "@/lib/rate-limit";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEnabledToolsFromDefinition } from "@/lib/tool-actions";
import {
  validateBody,
  validateWidgetChatBody,
} from "@/lib/validation/widget-schemas";
import {
  acquireWidgetSessionTurnLock,
  autoCaptureLead,
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

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
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

function buildRateLimitedResponse(
  request: NextRequest,
  error: string,
  code: string,
  retryAfterSeconds: number,
) {
  return Response.json(
    {
      error,
      code,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...buildWidgetRuntimeCorsHeaders(request),
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

const SESSION_BUSY_ERROR =
  "Another reply is already being generated for this chat. Please wait for the current response to finish.";
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

interface RequestedWidgetAttachment {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

async function resolveWidgetAttachments(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    widgetSessionId: string;
    attachments: Array<Pick<RequestedWidgetAttachment, "id">> | undefined;
  },
) {
  if (!input.attachments || input.attachments.length === 0) {
    return undefined;
  }

  const attachmentIds = input.attachments.map((attachment) => attachment.id);
  const { data, error } = await supabase
    .from("widget_attachments")
    .select<{
      id: string;
      widget_id: string;
      widget_session_id: string;
      storage_bucket: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      file_size_bytes: number;
    }>(
      "id, widget_id, widget_session_id, storage_bucket, storage_path, original_name, mime_type, file_size_bytes",
    )
    .eq("widget_id", input.widgetId)
    .eq("widget_session_id", input.widgetSessionId)
    .in("id", attachmentIds);

  if (error) {
    throw new Error("Failed to validate attachments.");
  }

  const rows = (data ?? []) as Array<{
    id: string;
    widget_id: string;
    widget_session_id: string;
    storage_bucket: string;
    storage_path: string;
    original_name: string;
    mime_type: string;
    file_size_bytes: number;
  }>;
  const rowById = new Map(rows.map((row) => [row.id, row]));

  if (rowById.size !== attachmentIds.length) {
    throw new Error("One or more attachments do not belong to this chat.");
  }

  return Promise.all(
    attachmentIds.map(async (attachmentId) => {
      const row = rowById.get(attachmentId);
      if (!row) {
        throw new Error("Attachment not found.");
      }

      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from(row.storage_bucket)
          .createSignedUrl(
            row.storage_path,
            ATTACHMENT_SIGNED_URL_TTL_SECONDS,
          );

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to create a secure attachment URL.");
      }

      return {
        id: row.id,
        url: signedUrlData.signedUrl,
        name: row.original_name,
        type: row.mime_type,
        size: row.file_size_bytes,
      };
    }),
  );
}

async function refreshWidgetHistoryAttachments(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    widgetSessionId: string;
    history: Awaited<ReturnType<typeof loadOrderedWidgetSessionHistory>>;
  },
) {
  return Promise.all(
    input.history.map(async (message) => {
      const rawAttachments = message.metadata?.attachments;

      if (!Array.isArray(rawAttachments)) {
        return message;
      }

      const attachmentIds = rawAttachments.flatMap((attachment) => {
        if (
          !attachment ||
          typeof attachment !== "object" ||
          !("id" in attachment) ||
          typeof attachment.id !== "string"
        ) {
          return [];
        }

        return [{ id: attachment.id }];
      });

      if (attachmentIds.length === 0) {
        return message;
      }

      try {
        const attachments = await resolveWidgetAttachments(supabase, {
          widgetId: input.widgetId,
          widgetSessionId: input.widgetSessionId,
          attachments: attachmentIds,
        });

        return {
          ...message,
          metadata: {
            ...message.metadata,
            attachments,
          },
        };
      } catch {
        return {
          ...message,
          metadata: {
            ...message.metadata,
            attachments: [],
          },
        };
      }
    }),
  );
}

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

    // This public endpoint is billable and writes chat state, so reject
    // malformed or oversized payloads before any session lookup, DB write, or
    // LLM call can run.
    const bodyValidation = await validateBody(request, validateWidgetChatBody);

    if (!bodyValidation.valid) {
      return buildErrorResponse(request, 400, bodyValidation.error);
    }

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "chat",
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: loaded.widget.id,
            sessionId: bodyValidation.value.sessionId,
          }),
        ),
      );

      if (!rateLimitDecision.allowed) {
        const payload = buildRateLimitErrorPayload(rateLimitDecision);
        return buildRateLimitedResponse(
          request,
          payload.error,
          payload.code,
          payload.retryAfterSeconds,
        );
      }
    }

    const {
      sessionId,
      message,
      widgetAgentId: requestedWidgetAgentId,
      pageUrl,
      referrer,
      attachments: requestedAttachments,
    } = bodyValidation.value;

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
    let attachments: Awaited<ReturnType<typeof resolveWidgetAttachments>>;

    try {
      attachments = await resolveWidgetAttachments(supabase, {
        widgetId: loaded.widget.id,
        widgetSessionId: widgetSession.id,
        attachments: requestedAttachments,
      });
    } catch (attachmentError) {
      return buildErrorResponse(
        request,
        400,
        attachmentError instanceof Error
          ? attachmentError.message
          : "Attachments are invalid.",
        "INVALID_ATTACHMENT",
      );
    }

    // Preview-token chat skips the public volumetric limiter, but it still
    // invokes OpenRouter and must spend workspace message credits.
    try {
      await consumeWorkspaceMessageUsage(
        supabase,
        loaded.widget.workspace_id,
      );
    } catch (usageError) {
      if (!(usageError instanceof MessageLimitExceededError)) {
        throw usageError;
      }

      return buildErrorResponse(
        request,
        usageError.status,
        usageError.message,
        usageError.code,
      );
    }

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
    await Promise.all([
      upsertWidgetSession(supabase, {
        widgetId: loaded.widget.id,
        sessionId,
        source: widgetSession.source,
        pageUrl: widgetSession.page_url,
        referrer: widgetSession.referrer,
        origin: widgetSession.origin,
        activeWidgetAgentId: widgetSession.active_widget_agent_id,
        activeAgentId: widgetSession.active_agent_id,
        lastUserMessageAt: userMessageTimestamp,
      }),
      insertWidgetMessages(supabase, {
        widgetSessionId: widgetSession.id,
        widgetId: loaded.widget.id,
        widgetAgentId: selected!.persistedWidgetAgentId,
        agentId: selected!.agent.id,
        messages: [{ role: "user", content: message, metadata: attachments ? { attachments } : undefined }],
      }),
    ]);

    const [history, publishedVersion] = await Promise.all([
      loadOrderedWidgetSessionHistory(supabase, widgetSession.id),
      getPublishedAgentVersion(supabase, selectedVersionId),
    ]);

    try {
      await autoCaptureLead(supabase, {
        widgetId: loaded.widget.id,
        widgetSessionId: widgetSession.id,
        widgetAgentId: selected!.persistedWidgetAgentId,
        agentId: selected!.agent.id,
        messages: history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });
    } catch (leadCaptureError) {
      console.error("Failed to auto-capture widget lead.", leadCaptureError);
    }

    const historyWithSecureAttachments = await refreshWidgetHistoryAttachments(
      supabase,
      {
        widgetId: loaded.widget.id,
        widgetSessionId: widgetSession.id,
        history,
      },
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
    const calSelection = extractCalSelectionFromDefinition(publishedVersion?.definition);
    const enabledToolsByToolkit = extractEnabledToolsFromDefinition(
      publishedVersion?.definition,
    );

    const calendarTimezone = googleCalendarSelection.timezone;
    const streamAbortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const abortStream = () => {
          if (!streamAbortController.signal.aborted) {
            streamAbortController.abort();
          }
        };
        const handleRequestAbort = () => {
          abortStream();
        };

        request.signal.addEventListener("abort", handleRequestAbort, {
          once: true,
        });

        try {
          const result = await runAgentChat({
            supabase: supabase as never,
            agent: runtimeAgent,
            input: message,
            history: historyWithSecureAttachments.map((item) => ({
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
              metadata: item.metadata,
            })),
            toolUserId: buildWorkspaceComposioUserId(selected!.agent.workspace_id),
            audience: "widget",
            widgetPublicKey: loaded.widget.widget_public_key,
            widgetSessionId: sessionId,
            calendarTimezone,
            googleCalendarSelection,
            calSelection,
            endChatPolicy,
            gmailRecipientPolicy,
            enabledToolsByToolkit,
            abortSignal: streamAbortController.signal,
            onToken: (token) => {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(sseChunk({ delta: token })));
            },
          });
          const assistantMessageTimestamp = new Date().toISOString();
          const persistedToolMessages = buildPersistedToolMessages(
            result.toolMessages,
          );

          await insertWidgetMessages(supabase, {
            widgetSessionId: widgetSession.id,
            widgetId: loaded.widget.id,
            widgetAgentId: selected!.persistedWidgetAgentId,
            agentId: selected!.agent.id,
            messages: [
              ...persistedToolMessages.map((toolMessage) => ({
                role: "tool" as const,
                content: String(toolMessage.content ?? ""),
                metadata: toolMessage,
              })),
              {
                role: "assistant" as const,
                content: result.assistantContent,
                metadata: {
                  ...buildPersistedAssistantMetadata(result.assistantMetadata),
                  ...(result.debugTrace ? { debugTrace: result.debugTrace } : {}),
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
          if (streamAbortController.signal.aborted || isAbortError(error)) {
            return;
          }

          const safeError = createClientSafeError(
            "public widget chat stream",
            error,
            "Something went wrong while generating a reply.",
          );
          controller.enqueue(
            new TextEncoder().encode(
              sseChunk({
                error: safeError.error,
                code: safeError.code,
                terminal: true,
              }),
            ),
          );
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        } finally {
          request.signal.removeEventListener("abort", handleRequestAbort);
          await releaseTurnLock(loaded.widget.id, sessionId);
          try {
            controller.close();
          } catch {
            // Ignore close errors after client cancellation.
          }
        }
      },
      cancel() {
        if (!streamAbortController.signal.aborted) {
          streamAbortController.abort();
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

    const safeError = createClientSafeError(
      "public widget chat",
      error,
      "Failed to run widget chat.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
