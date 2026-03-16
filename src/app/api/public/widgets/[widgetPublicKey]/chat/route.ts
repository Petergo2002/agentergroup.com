import { NextRequest } from "next/server";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDraftWidgetRuntimeAgents,
  buildWidgetCorsHeaders,
  buildStoredWidgetRuntimeAgents,
  getPublishedAgentVersion,
  getRequestedParentOrigin,
  getWidgetRequestSource,
  getWidgetRuntimeAgent,
  insertWidgetMessages,
  isAllowedWidgetOrigin,
  loadOrderedWidgetSessionHistory,
  loadWidgetByPublicKey,
  loadWidgetSession,
  resolveWidgetPreviewContext,
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
    { status, headers: buildWidgetCorsHeaders(request) },
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
  return new Response(null, {
    status: 204,
    headers: buildWidgetCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;

  try {
    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      loaded.widget,
      request,
    );

    if (!preview.isPreview && !isAllowedWidgetOrigin(loaded.widget, request)) {
      return buildErrorResponse(request, 403, "Domain is not allowed.");
    }

    if (!preview.isPreview && loaded.widget.status !== "deployed") {
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
    const widgetSession = await upsertWidgetSession(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      source: getWidgetRequestSource(request),
      pageUrl,
      referrer,
      origin: getRequestedParentOrigin(request),
      activeWidgetAgentId: selected!.persistedWidgetAgentId,
      activeAgentId: selected!.agent.id,
    });

    const history = await loadOrderedWidgetSessionHistory(
      supabase,
      widgetSession.id,
    );

    await insertWidgetMessages(supabase, {
      widgetSessionId: widgetSession.id,
      widgetId: loaded.widget.id,
      widgetAgentId: selected!.persistedWidgetAgentId,
      agentId: selected!.agent.id,
      messages: [{ role: "user", content: message }],
    });

    const selectedVersionId = preview.isPreview
      ? selected!.publishedVersionId ?? selected!.agent.published_version_id
      : selected!.publishedVersionId;

    if (!selectedVersionId) {
      if (!preview.isPreview) {
        return buildErrorResponse(
          request,
          409,
          "This agent is not deployed for the widget.",
          "WIDGET_AGENT_NOT_DEPLOYED",
        );
      }
    }

    const publishedVersion = await getPublishedAgentVersion(
      supabase,
      selectedVersionId,
    );
    const runtimeAgent = getWidgetRuntimeAgent(selected!.agent, publishedVersion);

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
    });

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
          metadata: result.assistantMetadata,
        },
      ],
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            sseChunk({ content: result.assistantContent }),
          ),
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...buildWidgetCorsHeaders(request),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return buildErrorResponse(
      request,
      500,
      error instanceof Error ? error.message : "Failed to run widget chat.",
    );
  }
}
