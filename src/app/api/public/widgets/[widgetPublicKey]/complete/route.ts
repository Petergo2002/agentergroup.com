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
  completeWidgetSession,
  handleConversationCompleted,
  isWidgetSessionTurnLocked,
  loadWidgetByPublicKey,
  loadWidgetSession,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";
import {
  canAccessWidgetSession,
  hashWidgetVisitorToken,
  readWidgetVisitorToken,
} from "@/lib/widgets/visitor";

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
) {
  return NextResponse.json(
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
  return NextResponse.json(
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

export async function POST(
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

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "complete",
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: loaded.widget.id,
            sessionId,
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

    const session = await loadWidgetSession(supabase, loaded.widget.id, sessionId);

    if (!session) {
      return buildErrorResponse(
        request,
        404,
        "Session not found.",
        "SESSION_NOT_FOUND",
      );
    }

    // Builder previews are bound to the visitor capability too, so the preview
    // surface gets the same real conversation history as a live visitor.
    const visitorToken = readWidgetVisitorToken(request);
    const visitorTokenHash = visitorToken
      ? hashWidgetVisitorToken(loaded.widget.id, visitorToken)
      : null;
    if (!canAccessWidgetSession(session.visitor_token_hash, visitorTokenHash)) {
      return buildErrorResponse(
        request,
        403,
        "This chat belongs to a different browser session.",
        "CONVERSATION_ACCESS_DENIED",
      );
    }

    if (isWidgetSessionTurnLocked(session)) {
      return buildErrorResponse(
        request,
        409,
        "Another reply is already being generated for this chat. Please wait for the current response to finish.",
        "SESSION_BUSY",
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
      { headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget complete",
      error,
      "Failed to complete chat session.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
