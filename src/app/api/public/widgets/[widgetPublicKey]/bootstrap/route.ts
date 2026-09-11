import { NextRequest, NextResponse } from "next/server";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWidgetBootstrapHeaders,
  buildStoredWidgetRuntimeConfig,
  buildWidgetAccessPayload,
  buildWidgetCorsHeaders,
  loadWidgetByPublicKey,
  resolveWidgetBootstrapAccess,
  resolveWidgetPreviewContext,
  signWidgetAccessToken,
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

export async function GET(
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
    const config =
      preview.runtimeConfig ??
      await buildStoredWidgetRuntimeConfig(
        supabase,
        loaded.widget,
        loaded.widgetAgents,
        {
        preview: preview.isPreview,
        },
      );

    if (preview.isPreview) {
      return NextResponse.json(
        {
          config,
          accessToken: null,
          source: "preview",
        },
        { headers: buildWidgetBootstrapHeaders(request, { preview: true }) },
      );
    }

    if (loaded.widget.status !== "deployed") {
      return buildErrorResponse(
        request,
        404,
        "Widget is not deployed.",
        "WIDGET_NOT_DEPLOYED",
      );
    }

    const access = resolveWidgetBootstrapAccess(loaded.widget, request);

    if (!access.ok) {
      return buildErrorResponse(
        request,
        access.status,
        access.error,
        access.code,
      );
    }

    const accessToken = await signWidgetAccessToken(
      buildWidgetAccessPayload({
        widgetPublicKey: loaded.widget.widget_public_key,
        widgetId: loaded.widget.id,
        source: access.source,
        allowedOrigin: access.allowedOrigin,
      }),
    );

    return NextResponse.json(
      {
        config,
        accessToken,
        source: access.source,
      },
      { headers: buildWidgetBootstrapHeaders(request, { preview: false }) },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget bootstrap",
      error,
      "Failed to bootstrap widget.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
