import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWidgetCorsHeaders,
  completeWidgetSession,
  handleConversationCompleted,
  loadWidgetByPublicKey,
  loadWidgetSession,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
) {
  return NextResponse.json(
    code ? { error, code } : { error },
    { status, headers: buildWidgetCorsHeaders(request) },
  );
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
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
    const reason = String(body.reason ?? "").trim();

    if (!sessionId) {
      return buildErrorResponse(request, 400, "sessionId is required.");
    }

    if (reason !== "inactivity_timeout") {
      return buildErrorResponse(
        request,
        400,
        "Unsupported completion reason.",
        "INVALID_END_REASON",
      );
    }

    const session = await loadWidgetSession(supabase, loaded.widget.id, sessionId);

    if (!session) {
      return buildErrorResponse(
        request,
        404,
        "Session not found.",
        "SESSION_NOT_FOUND",
      );
    }

    const wasCompleted = session.status === "completed";
    const completedSession = await completeWidgetSession(supabase, {
      session,
      reason: "inactivity_timeout",
    });

    if (!wasCompleted) {
      await handleConversationCompleted({
        widget: loaded.widget,
        session: completedSession,
        reason: "inactivity_timeout",
      });
    }

    return NextResponse.json(
      {
        ok: true,
        sessionCompleted: true,
        endReason: completedSession.end_reason,
      },
      { headers: buildWidgetCorsHeaders(request) },
    );
  } catch (error) {
    return buildErrorResponse(
      request,
      500,
      error instanceof Error ? error.message : "Failed to complete chat session.",
    );
  }
}
