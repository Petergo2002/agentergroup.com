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
  validateBody,
  validateWidgetEventBody,
} from "@/lib/validation/widget-schemas";
import {
  buildWidgetRuntimeCorsHeaders,
  loadWidgetRecordByPublicKey,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type WidgetAdminSupabase,
  upsertWidgetSession,
} from "@/lib/widgets/server";

/** Events that evidence a visitor leaving, which must not refresh presence. */
const EXIT_EVENT_TYPES = new Set(["page_hidden", "page_unload"]);

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

    if (access.source !== "preview" && widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    // Presence events are public and best-effort, but they still update stored
    // session state, so reject unknown event types and oversized payloads
    // before any write occurs.
    const bodyValidation = await validateBody(request, validateWidgetEventBody);

    if (!bodyValidation.valid) {
      return buildErrorResponse(request, 400, bodyValidation.error);
    }

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "events",
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: widget.id,
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

    const { sessionId, eventType, pageUrl, referrer } = bodyValidation.value;

    // This endpoint is presence tracking, not an analytics event stream: the
    // only thing any consumer reads is widget_sessions.last_seen_at, which
    // drives the live/idle badge in analytics and the stale-session sweep.
    // The event type is still validated (an allowlist is a cheap input
    // control) but it is not stored, because nothing reads it.
    //
    // Exit events are the exception that matters. page_hidden and page_unload
    // mean the visitor has gone, so refreshing last_seen_at on them marked a
    // departed visitor as "live" for another 90 seconds and pushed back the
    // 30-minute inactivity sweep. Presence is only refreshed by events that
    // actually evidence presence.
    if (!EXIT_EVENT_TYPES.has(eventType)) {
      await upsertWidgetSession(supabase, {
        widgetId: widget.id,
        sessionId,
        source: access.source,
        pageUrl,
        referrer,
        origin: access.origin,
      });
    }

    return NextResponse.json(
      { ok: true },
      { headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget events",
      error,
      "Failed to record widget event.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
