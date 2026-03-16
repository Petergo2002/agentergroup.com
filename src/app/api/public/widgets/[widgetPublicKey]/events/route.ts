import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWidgetCorsHeaders,
  getRequestedParentOrigin,
  getWidgetRequestSource,
  isAllowedWidgetOrigin,
  loadWidgetByPublicKey,
  resolveWidgetPreviewContext,
  type WidgetAdminSupabase,
  upsertWidgetSession,
} from "@/lib/widgets/server";

function buildErrorResponse(request: NextRequest, status: number, error: string) {
  return NextResponse.json(
    { error },
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

    if (!preview.isPreview && !isAllowedWidgetOrigin(loaded.widget, request)) {
      return buildErrorResponse(request, 403, "Domain is not allowed.");
    }

    if (!preview.isPreview && loaded.widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.sessionId ?? "").trim();
    const pageUrl = String(body.pageUrl ?? "").trim() || null;
    const referrer = String(body.referrer ?? "").trim() || null;

    if (!sessionId) {
      return buildErrorResponse(request, 400, "sessionId is required.");
    }

    await upsertWidgetSession(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      source: getWidgetRequestSource(request),
      pageUrl,
      referrer,
      origin: getRequestedParentOrigin(request),
    });

    return NextResponse.json(
      { ok: true },
      { headers: buildWidgetCorsHeaders(request) },
    );
  } catch (error) {
    return buildErrorResponse(
      request,
      500,
      error instanceof Error ? error.message : "Failed to record widget event.",
    );
  }
}
