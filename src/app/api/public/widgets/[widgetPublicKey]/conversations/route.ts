import { NextRequest, NextResponse } from "next/server";
import {
  buildPublicWidgetRateLimitContext,
  buildRateLimitErrorPayload,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
} from "@/lib/rate-limit";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWidgetRuntimeCorsHeaders,
  loadWidgetRecordByPublicKey,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  resolveWidgetRuntimeRequestOrigin,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";
import type { WidgetOrderedInSelectBuilder } from "@/lib/widgets/server-types";
import {
  hashWidgetVisitorToken,
  readWidgetVisitorToken,
} from "@/lib/widgets/visitor";
import type { WidgetGenerativeUi } from "@/lib/widgets/generative-ui";
import {
  readWidgetAttachmentIds,
  resolveWidgetAttachmentUrls,
  type WidgetAttachmentUrl,
} from "@/lib/widgets/attachment-urls";

const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 100;

interface ConversationSummaryRow {
  session_id: string;
  active_widget_agent_id: string | null;
  status: string;
  conversation_title: string | null;
  last_message_preview: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface ConversationDetailRow extends ConversationSummaryRow {
  id: string;
  end_reason: string | null;
}

interface ConversationMessageRow {
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
  retryAfterSeconds?: number,
) {
  return NextResponse.json(
    {
      error,
      ...(code ? { code } : {}),
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
    {
      status,
      headers: {
        ...buildWidgetRuntimeCorsHeaders(request),
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function historyHeaders(request: NextRequest) {
  return {
    ...buildWidgetRuntimeCorsHeaders(request),
    "Cache-Control": "private, no-store",
  };
}

/**
 * Builder previews and live visitors share one storage table, so history is
 * always scoped to the source the caller is actually running in. A preview
 * never sees live visitor chats, and a live visitor never sees draft previews.
 */
function scopeToRuntimeSource<TData>(
  query: WidgetOrderedInSelectBuilder<TData>,
  isPreviewAccess: boolean,
) {
  return isPreviewAccess
    ? query.eq("source", "preview")
    : query.neq("source", "preview");
}

function readGenerativeUi(value: unknown): WidgetGenerativeUi | undefined {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return undefined;
  }

  const type = (value as { type?: unknown }).type;
  return type === "calendar_availability" ||
    type === "calendar_booking_confirmation"
    ? (value as WidgetGenerativeUi)
    : undefined;
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

  return new NextResponse(null, {
    status: 204,
    headers: buildWidgetRuntimeCorsHeaders(request),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  try {
    if (!runtimeOrigin.ok) {
      return buildErrorResponse(
        request,
        runtimeOrigin.status,
        runtimeOrigin.error,
        runtimeOrigin.code,
      );
    }

    const widget = await loadWidgetRecordByPublicKey(supabase, widgetPublicKey);
    if (!widget) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      widget,
      request,
    );
    const access = await resolveWidgetRuntimeAccess({
      request,
      widget,
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

    const isPreviewAccess = access.source === "preview";

    // Previews run against unpublished drafts, so only live runtimes require a
    // deployed widget.
    if (!isPreviewAccess && widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    const visitorToken = readWidgetVisitorToken(request);
    if (!visitorToken) {
      return buildErrorResponse(
        request,
        401,
        "Conversation history is unavailable for this browser.",
        "VISITOR_TOKEN_REQUIRED",
      );
    }

    const rateLimitDecision = await enforceRateLimits(
      supabase,
      getPublicWidgetRateLimitRules(
        "history",
        buildPublicWidgetRateLimitContext({
          request,
          widgetId: widget.id,
          sessionId: request.nextUrl.searchParams.get("sessionId"),
        }),
      ),
    );

    if (!rateLimitDecision.allowed) {
      const payload = buildRateLimitErrorPayload(rateLimitDecision);
      return buildErrorResponse(
        request,
        429,
        payload.error,
        payload.code,
        payload.retryAfterSeconds,
      );
    }

    const visitorTokenHash = hashWidgetVisitorToken(
      widget.id,
      visitorToken,
    );
    const requestedSessionId = request.nextUrl.searchParams
      .get("sessionId")
      ?.trim();

    if (!requestedSessionId) {
      const { data, error } = await scopeToRuntimeSource(
        supabase
          .from("widget_sessions")
          .select<ConversationSummaryRow>(
            "session_id, active_widget_agent_id, status, conversation_title, last_message_preview, first_seen_at, last_seen_at",
          )
          .eq("widget_id", widget.id)
          .eq("visitor_token_hash", visitorTokenHash),
        isPreviewAccess,
      )
        .not("last_user_message_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(MAX_CONVERSATIONS);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json(
        {
          conversations: (data ?? []).map((session) => ({
            sessionId: session.session_id,
            widgetAgentId: session.active_widget_agent_id,
            status: session.status === "completed" ? "completed" : "active",
            title: session.conversation_title || "Conversation",
            preview: session.last_message_preview,
            createdAt: session.first_seen_at,
            updatedAt: session.last_seen_at,
          })),
        },
        { headers: historyHeaders(request) },
      );
    }

    const { data: session, error: sessionError } = await scopeToRuntimeSource(
      supabase
        .from("widget_sessions")
        .select<ConversationDetailRow>(
          "id, session_id, active_widget_agent_id, status, end_reason, conversation_title, last_message_preview, first_seen_at, last_seen_at",
        )
        .eq("widget_id", widget.id)
        .eq("session_id", requestedSessionId)
        .eq("visitor_token_hash", visitorTokenHash),
      isPreviewAccess,
    ).maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session) {
      return buildErrorResponse(
        request,
        404,
        "Conversation not found.",
        "CONVERSATION_NOT_FOUND",
      );
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from("widget_session_messages")
      .select<ConversationMessageRow>("role, content, metadata, created_at")
      .eq("widget_id", widget.id)
      .eq("widget_session_id", session.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(MAX_MESSAGES_PER_CONVERSATION);

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const orderedMessages = [...(messageRows ?? [])].reverse().map((message) => ({
      ...message,
      metadata:
        message.metadata && typeof message.metadata === "object"
          ? (message.metadata as Record<string, unknown>)
          : {},
    }));

    const attachmentIdsByMessage = orderedMessages.map((message) =>
      message.role === "user"
        ? readWidgetAttachmentIds(message.metadata.attachments)
        : [],
    );

    const { byId: restoredAttachments } = await resolveWidgetAttachmentUrls(
      supabase,
      {
        widgetId: widget.id,
        widgetSessionId: session.id,
        attachmentIds: attachmentIdsByMessage.flat(),
      },
    );

    const messages = orderedMessages.map((message, index) => {
      const attachments = attachmentIdsByMessage[index]
        .map((attachmentId) => restoredAttachments.get(attachmentId))
        .filter(
          (attachment): attachment is WidgetAttachmentUrl =>
            attachment !== undefined,
        );

      return {
        role: message.role === "assistant" ? "agent" : "user",
        content: message.content,
        createdAt: message.created_at,
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(message.role === "assistant"
          ? { ui: readGenerativeUi(message.metadata.generativeUi) }
          : {}),
      };
    });

    return NextResponse.json(
      {
        conversation: {
          sessionId: session.session_id,
          widgetAgentId: session.active_widget_agent_id,
          status: session.status === "completed" ? "completed" : "active",
          endReason:
            session.end_reason === "assistant_suggestion" ||
            session.end_reason === "inactivity_timeout"
              ? session.end_reason
              : null,
          title: session.conversation_title || "Conversation",
          preview: session.last_message_preview,
          createdAt: session.first_seen_at,
          updatedAt: session.last_seen_at,
          messages,
        },
      },
      { headers: historyHeaders(request) },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget conversation history",
      error,
      "Failed to load conversation history.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
