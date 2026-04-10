import { NextRequest, NextResponse } from "next/server";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildStoredWidgetRuntimeConfig,
  buildWidgetRuntimeCorsHeaders,
  loadWidgetByPublicKey,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

export async function OPTIONS(request: NextRequest) {
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  if (!runtimeOrigin.ok) {
    return NextResponse.json(
      { error: runtimeOrigin.error, code: runtimeOrigin.code },
      { status: runtimeOrigin.status, headers: buildWidgetRuntimeCorsHeaders(request) },
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
      return NextResponse.json(
        { error: runtimeOrigin.error, code: runtimeOrigin.code },
        { status: runtimeOrigin.status, headers: buildWidgetRuntimeCorsHeaders(request) },
      );
    }

    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return NextResponse.json(
        { error: "Widget not found." },
        { status: 404, headers: buildWidgetRuntimeCorsHeaders(request) },
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
        { status: access.status, headers: buildWidgetRuntimeCorsHeaders(request) },
      );
    }

    if (access.source !== "preview" && loaded.widget.status !== "deployed") {
      return NextResponse.json(
        { error: "Widget is not deployed.", code: "WIDGET_NOT_DEPLOYED" },
        { status: 404, headers: buildWidgetRuntimeCorsHeaders(request) },
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
        headers: buildWidgetRuntimeCorsHeaders(request),
      },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget config",
      error,
      "Failed to load widget config.",
    );
    return NextResponse.json(
      safeError,
      { status: 500, headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  }
}
