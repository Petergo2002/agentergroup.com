import type { NextRequest } from "next/server";
import { getWidgetAppUrl } from "@/lib/env";
import {
  buildAllowedOriginHeaders,
  buildWidgetCorsHeaders,
  getRequestOrigin,
  normalizeAllowedOrigin,
  normalizeAllowedOrigins,
} from "@/lib/widgets/http";
import type { WidgetRecord } from "@/lib/types";
import type {
  WidgetPreviewTokenPayload,
} from "./server-types";
import { verifyWidgetAccessToken } from "./tokens";

export { buildWidgetCorsHeaders, getRequestOrigin };

function getWidgetRuntimeAllowedOrigins() {
  const runtimeOrigin = normalizeAllowedOrigin(getWidgetAppUrl());
  const origins = new Set<string>();

  if (runtimeOrigin) {
    origins.add(runtimeOrigin);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }

  return Array.from(origins);
}

function getWidgetHostedOrigin() {
  return normalizeAllowedOrigin(getWidgetAppUrl());
}

export function resolveWidgetRuntimeRequestOrigin(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const allowedOrigins = getWidgetRuntimeAllowedOrigins();

  if (!requestOrigin) {
    return {
      ok: false as const,
      status: 403,
      error: "Runtime request origin is missing.",
      code: "WIDGET_RUNTIME_ORIGIN_REQUIRED",
    };
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    return {
      ok: false as const,
      status: 403,
      error: "Runtime request origin is not allowed.",
      code: "WIDGET_RUNTIME_ORIGIN_INVALID",
    };
  }

  return {
    ok: true as const,
    origin: requestOrigin,
  };
}

export function buildWidgetRuntimeCorsHeaders(request: NextRequest) {
  const requestOrigin = normalizeAllowedOrigin(request.headers.get("origin"));
  const allowedOrigins = getWidgetRuntimeAllowedOrigins();
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : null;

  return buildAllowedOriginHeaders(allowedOrigin);
}

export function buildWidgetBootstrapHeaders(
  request: NextRequest,
  options?: { preview?: boolean },
) {
  return {
    ...buildWidgetCorsHeaders(request),
    "Cache-Control": options?.preview
      ? "no-store, no-cache, must-revalidate"
      : "public, max-age=60, stale-while-revalidate=300",
  };
}

export function resolveWidgetBootstrapAccess(
  widget: WidgetRecord,
  request: NextRequest,
) {
  const requestOrigin = getRequestOrigin(request);
  const hostedOrigin = getWidgetHostedOrigin();

  if (requestOrigin && hostedOrigin && requestOrigin === hostedOrigin) {
    if (!widget.hosted_enabled) {
      return {
        ok: false as const,
        status: 403,
        error: "Hosted widget access is disabled.",
        code: "HOSTED_WIDGET_DISABLED",
      };
    }

    return {
      ok: true as const,
      source: "hosted" as const,
      allowedOrigin: null,
      origin: requestOrigin,
    };
  }

  const allowedOrigins = normalizeAllowedOrigins(widget.allowed_origins);

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      ok: true as const,
      source: "embedded" as const,
      allowedOrigin: requestOrigin,
      origin: requestOrigin,
    };
  }

  return {
    ok: false as const,
    status: 403,
    error: requestOrigin ? "Domain is not allowed." : "Request origin is missing.",
    code: requestOrigin ? "WIDGET_DOMAIN_NOT_ALLOWED" : "WIDGET_ORIGIN_REQUIRED",
  };
}

export async function resolveWidgetRuntimeAccess(args: {
  request: NextRequest;
  widget: WidgetRecord;
  preview: {
    isPreview: boolean;
    previewPayload: WidgetPreviewTokenPayload | null;
  };
}) {
  const { request, widget, preview } = args;

  if (preview.isPreview && preview.previewPayload) {
    return {
      ok: true as const,
      source: "preview" as const,
      origin: getRequestOrigin(request),
    };
  }

  const accessToken = await verifyWidgetAccessToken(
    request.headers.get("x-ag-widget-access-token"),
    widget.widget_public_key,
  );

  if (!accessToken || accessToken.widgetId !== widget.id) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing or invalid widget access token.",
      code: "WIDGET_ACCESS_TOKEN_INVALID",
    };
  }

  if (accessToken.source === "hosted") {
    if (!widget.hosted_enabled) {
      return {
        ok: false as const,
        status: 403,
        error: "Hosted widget access is disabled.",
        code: "HOSTED_WIDGET_DISABLED",
      };
    }

    return {
      ok: true as const,
      source: "hosted" as const,
      origin: getWidgetHostedOrigin(),
    };
  }

  const allowedOrigins = normalizeAllowedOrigins(widget.allowed_origins);

  if (!accessToken.allowedOrigin || !allowedOrigins.includes(accessToken.allowedOrigin)) {
    return {
      ok: false as const,
      status: 403,
      error: "Domain is not allowed.",
      code: "WIDGET_DOMAIN_NOT_ALLOWED",
    };
  }

  return {
    ok: true as const,
    source: "embedded" as const,
    origin: accessToken.allowedOrigin,
  };
}