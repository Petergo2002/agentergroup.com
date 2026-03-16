import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWidgetRuntimeConfig } from "@/lib/widgets";
import {
  buildWidgetCorsHeaders,
  isAllowedWidgetOrigin,
  loadWidgetByPublicKey,
  resolveWidgetPreviewContext,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildWidgetCorsHeaders(request),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;

  try {
    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return NextResponse.json(
        { error: "Widget not found." },
        { status: 404, headers: buildWidgetCorsHeaders(request) },
      );
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      loaded.widget,
      request,
    );

    if (!preview.isPreview && !isAllowedWidgetOrigin(loaded.widget, request)) {
      return NextResponse.json(
        { error: "Domain is not allowed." },
        { status: 403, headers: buildWidgetCorsHeaders(request) },
      );
    }

    if (!preview.isPreview && loaded.widget.status !== "deployed") {
      return NextResponse.json(
        { error: "Widget is not deployed.", code: "WIDGET_NOT_DEPLOYED" },
        { status: 404, headers: buildWidgetCorsHeaders(request) },
      );
    }

    return NextResponse.json(
      preview.runtimeConfig ??
        buildWidgetRuntimeConfig(loaded.widget, loaded.widgetAgents, {
          preview: preview.isPreview,
        }),
      { headers: buildWidgetCorsHeaders(request) },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load widget config.",
      },
      { status: 500, headers: buildWidgetCorsHeaders(request) },
    );
  }
}
