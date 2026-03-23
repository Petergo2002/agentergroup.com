import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWidgetBootstrapHeaders,
  buildStoredWidgetRuntimeConfig,
  buildWidgetCorsHeaders,
  loadWidgetByPublicKey,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
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

    const access = await resolveWidgetRuntimeAccess({
      request,
      widget: loaded.widget,
      preview,
    });

    if (!access.ok) {
      return NextResponse.json(
        access.code ? { error: access.error, code: access.code } : { error: access.error },
        { status: access.status, headers: buildWidgetCorsHeaders(request) },
      );
    }

    if (access.source !== "preview" && loaded.widget.status !== "deployed") {
      return NextResponse.json(
        { error: "Widget is not deployed.", code: "WIDGET_NOT_DEPLOYED" },
        { status: 404, headers: buildWidgetCorsHeaders(request) },
      );
    }

    return NextResponse.json(
      preview.runtimeConfig ??
        (await buildStoredWidgetRuntimeConfig(
          supabase,
          loaded.widget,
          loaded.widgetAgents,
          {
            preview: preview.isPreview,
          },
        )),
      {
        headers: buildWidgetBootstrapHeaders(request, {
          preview: preview.isPreview,
        }),
      },
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
