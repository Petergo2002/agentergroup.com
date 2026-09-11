import { after, NextRequest } from "next/server";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  buildPersistedAssistantMetadata,
  buildPersistedToolMessages,
} from "@/lib/debug-trace-security";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import {
  buildConversationExcerpt,
  createUnansweredQueryCandidate,
  detectUnansweredQueryCandidate,
} from "@/lib/flywheel/server";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { extractCalSelectionFromDefinition } from "@/lib/cal";
import { generateLeadConversationSummary } from "@/lib/leads/conversation-summary";
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
import { readAgentIdFromDraftPreviewWidgetAgentId } from "@/lib/widgets";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEnabledToolsFromDefinition } from "@/lib/tool-actions";
import { buildWidgetGenerativeUi } from "@/lib/widgets/generative-ui";
import {
  buildConversationPreview,
  buildConversationTitle,
  hashWidgetVisitorToken,
  readWidgetVisitorToken,
} from "@/lib/widgets/visitor";
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
  resolveSelectedWidgetAgent,
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

function getErrorLogFields(error: unknown) {
  if (!(error instanceof Error)) {
    return { error: String(error) };
  }

  const errorRecord = error as Error & {
    code?: unknown;
    status?: unknown;
    retryAfterSeconds?: unknown;
  };
  return {
    errorName: error.name,
    error: error.message,
    ...(typeof errorRecord.code === "string" ||
    typeof errorRecord.code === "number"
      ? { errorCode: errorRecord.code }
      : {}),
    ...(typeof errorRecord.status === "number"
      ? { upstreamStatus: errorRecord.status }
      : {}),
    ...(typeof errorRecord.retryAfterSeconds === "number"
      ? { retryAfterSeconds: errorRecord.retryAfterSeconds }
      : {}),
  };
}

function logWidgetChatEvent(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
) {
  const entry = JSON.stringify({
    level,
    event,
    route: "/api/public/widgets/[widgetPublicKey]/chat",
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
  } else {
    console.info(entry);
  }
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
  const chatRequestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
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
    // Builder previews are bound to the visitor capability too, so the preview
    // surface gets the same real conversation history as a live visitor.
    const visitorToken = readWidgetVisitorToken(request);
    const visitorTokenHash = visitorToken
      ? hashWidgetVisitorToken(loaded.widget.id, visitorToken)
      : null;

    if (
      existingSession?.visitor_token_hash &&
      existingSession.visitor_token_hash !== visitorTokenHash
    ) {
      return buildErrorResponse(
        request,
        403,
        "This chat belongs to a different browser session.",
        "CONVERSATION_ACCESS_DENIED",
      );
    }

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
    // Resolve the requested id to its agent so a request still matches when the
    // runtime has switched between the draft and stored shapes mid-conversation
    // (draft ids carry the agent id; stored ids resolve through widget_agents).
    const requestedAgentId = requestedWidgetAgentId
      ? readAgentIdFromDraftPreviewWidgetAgentId(requestedWidgetAgentId) ??
        loaded.widgetAgents.find(
          (entry) => entry.widgetAgent.id === requestedWidgetAgentId,
        )?.agent.id ??
        null
      : null;
    const selection = resolveSelectedWidgetAgent({
      widgetAgents: runtimeWidgetAgents,
      activeWidgetAgentId: existingSession?.active_widget_agent_id ?? null,
      activeAgentId: existingSession?.active_agent_id ?? null,
      requestedWidgetAgentId,
      requestedAgentId,
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
      visitorTokenHash:
        existingSession?.visitor_token_hash ?? visitorTokenHash,
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

    turnRequestId = chatRequestId;
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

    // Charge only after the turn is accepted: busy/completed sessions must not
    // spend credits. Preview-token chat is still billable, just like public chat.
    try {
      await consumeWorkspaceMessageUsage(
        supabase,
        loaded.widget.workspace_id,
      );
    } catch (usageError) {
      if (!(usageError instanceof MessageLimitExceededError)) {
        throw usageError;
      }

      await releaseTurnLock(loaded.widget.id, sessionId);
      return buildErrorResponse(
        request,
        usageError.status,
        usageError.message,
        usageError.code,
      );
    }

    const userMessageTimestamp = new Date().toISOString();
    const [, userMessageRows] = await Promise.all([
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
        visitorTokenHash: widgetSession.visitor_token_hash,
        conversationTitle:
          widgetSession.conversation_title ?? buildConversationTitle(message),
        lastMessagePreview: buildConversationPreview(message),
      }),
      insertWidgetMessages(supabase, {
        widgetSessionId: widgetSession.id,
        widgetId: loaded.widget.id,
        widgetAgentId: selected!.persistedWidgetAgentId,
        agentId: selected!.agent.id,
        messages: [{ role: "user", content: message, metadata: attachments ? { attachments } : undefined }],
      }),
    ]);
    const userMessageId =
      userMessageRows.find((row) => row.role === "user")?.id ?? null;

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
        const scheduleFlywheelCapture = (input: {
          assistantAnswer: string;
          assistantMessageId: string | null;
          knowledgeMatchCount: number;
          runtimeHadError: boolean;
          detectionReason?: string;
          confidence?: number;
          modelFlaggedGap?: {
            question: string | null;
            reason: string | null;
          } | null;
          metadata?: Record<string, unknown>;
        }) => {
          if (access.source === "preview") {
            return;
          }

          after(async () => {
            const detection = detectUnansweredQueryCandidate({
              question: message,
              assistantAnswer: input.assistantAnswer,
              knowledgeMatchCount: input.knowledgeMatchCount,
              runtimeHadError: input.runtimeHadError,
              modelFlaggedGap: input.modelFlaggedGap ?? null,
            });

            if (!detection.shouldCreate) {
              return;
            }

            try {
              await createUnansweredQueryCandidate(createAdminClient() as never, {
                workspaceId: loaded.widget.workspace_id,
                widgetId: loaded.widget.id,
                widgetAgentId: selected!.persistedWidgetAgentId,
                agentId: selected!.agent.id,
                widgetSessionId: widgetSession.id,
                userMessageId,
                assistantMessageId: input.assistantMessageId,
                question: detection.question,
                assistantAnswer: input.assistantAnswer,
                contextExcerpt: buildConversationExcerpt(
                  history.slice(0, -1).map((item) => ({
                    role: item.role,
                    content: item.content,
                  })),
                  detection.question,
                ),
                detectionReason: input.detectionReason ?? detection.reason,
                confidence: input.confidence ?? detection.confidence,
                metadata: {
                  requestId: chatRequestId,
                  knowledgeMatchCount: input.knowledgeMatchCount,
                  runtimeHadError: input.runtimeHadError,
                  // Comparison data: which signal fired, and whether the legacy
                  // patterns would have caught this on their own.
                  detectionSource: detection.source,
                  patternWouldCreate: detection.patternWouldCreate,
                  ...(input.metadata ?? {}),
                },
              });
            } catch (error) {
              console.error("[flywheel] Failed to create unanswered query.", {
                requestId: chatRequestId,
                widgetId: loaded.widget.id,
                agentId: selected!.agent.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          });
        };

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
            widgetSessionId: widgetSession.id,
            calendarTimezone,
            googleCalendarSelection,
            calSelection,
            endChatPolicy,
            gmailRecipientPolicy,
            enabledToolsByToolkit,
            publishedDefinition: publishedVersion?.definition,
            abortSignal: streamAbortController.signal,
            onToken: (token) => {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(sseChunk({ delta: token })));
            },
            // Knowledge retrieval and tool execution both run before the first
            // token, so without these the visitor watches a motionless typing
            // indicator for the slowest part of the turn.
            onStatus: (status) => {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(sseChunk({ status })));
            },
          });
          const assistantMessageTimestamp = new Date().toISOString();
          const persistedToolMessages = buildPersistedToolMessages(
            result.toolMessages,
          );
          const generativeUi = buildWidgetGenerativeUi({
            toolMessages: result.toolMessages,
            timezone: calendarTimezone ?? selected!.agent.timezone,
            durationMinutes: googleCalendarSelection.meetingDurationMinutes,
          });

          if (generativeUi) {
            controller.enqueue(
              new TextEncoder().encode(sseChunk({ ui: generativeUi })),
            );
          }

          const persistedMessages = await insertWidgetMessages(supabase, {
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
                  ...(generativeUi ? { generativeUi } : {}),
                  ...(result.debugTrace ? { debugTrace: result.debugTrace } : {}),
                },
              },
            ],
          });
          const assistantMessageId =
            persistedMessages.find((row) => row.role === "assistant")?.id ?? null;

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
            visitorTokenHash: widgetSession.visitor_token_hash,
            conversationTitle:
              widgetSession.conversation_title ?? buildConversationTitle(message),
            lastMessagePreview: buildConversationPreview(
              result.assistantContent,
            ),
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

          logWidgetChatEvent("info", "widget_chat_completed", {
            requestId: chatRequestId,
            widgetId: loaded.widget.id,
            agentId: selected!.agent.id,
            durationMs: Date.now() - requestStartedAt,
            assistantCharacters: result.assistantContent.length,
            toolMessageCount: result.toolMessages.length,
            knowledgeMatchCount: result.knowledgeMatches.length,
            runtimeHadError: result.debugTrace?.hadError ?? false,
            ...(result.debugTrace?.errorSummary
              ? { runtimeErrorSummary: result.debugTrace.errorSummary }
              : {}),
          });

          scheduleFlywheelCapture({
            assistantAnswer: result.assistantContent,
            assistantMessageId,
            knowledgeMatchCount: result.knowledgeMatches.length,
            runtimeHadError: result.debugTrace?.hadError ?? false,
            modelFlaggedGap: result.knowledgeGap,
            metadata: result.debugTrace?.errorSummary
              ? { runtimeErrorSummary: result.debugTrace.errorSummary }
              : undefined,
          });

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
          const errorFields = getErrorLogFields(error);
          logWidgetChatEvent("error", "widget_chat_stream_failed", {
            requestId: chatRequestId,
            widgetId: loaded.widget.id,
            agentId: selected!.agent.id,
            durationMs: Date.now() - requestStartedAt,
            ...errorFields,
          });
          scheduleFlywheelCapture({
            assistantAnswer: safeError.error,
            assistantMessageId: null,
            knowledgeMatchCount: 0,
            runtimeHadError: true,
            detectionReason: "The widget runtime failed before producing an answer.",
            confidence: 0.92,
            metadata: {
              ...errorFields,
              ...(safeError.code ? { clientErrorCode: safeError.code } : {}),
            },
          });
          controller.enqueue(
            new TextEncoder().encode(
              sseChunk({
                error: safeError.error,
                code: safeError.code,
                requestId: chatRequestId,
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

    after(async () => {
      try {
        await generateLeadConversationSummary(createAdminClient(), {
          widgetSessionId: widgetSession.id,
        });
      } catch (error) {
        console.error("Background lead summary generation failed.", {
          widgetSessionId: widgetSession.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
    logWidgetChatEvent("error", "widget_chat_request_failed", {
      requestId: chatRequestId,
      durationMs: Date.now() - requestStartedAt,
      ...getErrorLogFields(error),
    });
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
