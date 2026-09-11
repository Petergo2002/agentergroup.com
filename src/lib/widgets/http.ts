export interface WidgetRequestLike {
  headers: {
    get(name: string): string | null;
  };
}

export const WIDGET_CORS_ALLOW_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
export const WIDGET_CORS_ALLOW_HEADERS =
  "Content-Type,x-ag-widget-access-token,x-ag-widget-visitor-token,x-ag-preview-token,x-ag-preview-source,x-ag-preview-revision,x-ag-widget-context,x-ag-parent-origin";

export function normalizeAllowedOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function normalizeAllowedOrigins(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeAllowedOrigin(value)).filter(Boolean)),
  ) as string[];
}

export function getRequestOrigin(request: WidgetRequestLike) {
  return normalizeAllowedOrigin(request.headers.get("origin"));
}

export function buildAllowedOriginHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": WIDGET_CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": WIDGET_CORS_ALLOW_HEADERS,
    Vary: "Origin",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function buildWidgetCorsHeaders(request: WidgetRequestLike) {
  return buildAllowedOriginHeaders(getRequestOrigin(request));
}
