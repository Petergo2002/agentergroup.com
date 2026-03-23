import type { WidgetBootstrapResponse, WidgetConfig } from "../types";

export interface WidgetRequestContext {
  accessToken?: string | null;
  previewToken?: string;
  previewSource?: string;
  previewRevision?: string;
}

export function resolveWidgetApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  if (typeof window !== "undefined") {
    const runtimeOverride = (window as Window & { AG_WIDGET_API_URL?: string })
      .AG_WIDGET_API_URL;

    if (runtimeOverride) {
      return runtimeOverride;
    }

    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3000";
    }
  }

  return "https://dashboard.agentergroup.com";
}

function getApiBase(): string {
  return resolveWidgetApiBase();
}

function buildWidgetHeaders(
  context: WidgetRequestContext,
  options?: { includeContentType?: boolean },
) {
  const headers: Record<string, string> = {};

  if (options?.includeContentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (context.accessToken) {
    headers["x-ag-widget-access-token"] = context.accessToken;
  }

  if (context.previewToken) {
    headers["x-ag-preview-token"] = context.previewToken;
  }

  if (context.previewSource) {
    headers["x-ag-preview-source"] = context.previewSource;
  }

  if (context.previewRevision) {
    headers["x-ag-preview-revision"] = context.previewRevision;
  }

  return headers;
}

async function parseError(response: Response) {
  const payload = await response.json().catch(() => null);
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Request failed with status ${response.status}.`;
  const error = new Error(message) as Error & { code?: string };
  if (typeof payload?.code === "string") {
    error.code = payload.code;
  }
  throw error;
}

function buildWidgetUrl(widgetPublicKey: string, path: string) {
  return `${getApiBase()}/api/public/widgets/${encodeURIComponent(widgetPublicKey)}${path}`;
}

export async function getWidgetBootstrap(
  widgetPublicKey: string,
  context: WidgetRequestContext,
) {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/bootstrap"), {
    headers: buildWidgetHeaders(context, { includeContentType: false }),
    cache: "no-store",
  });

  if (!response.ok) {
    await parseError(response);
  }

  return (await response.json()) as WidgetBootstrapResponse;
}

export async function getWidgetConfig(
  widgetPublicKey: string,
  context: WidgetRequestContext,
) {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/config"), {
    headers: buildWidgetHeaders(context, { includeContentType: false }),
    cache: "no-store",
  });

  if (!response.ok) {
    await parseError(response);
  }

  return (await response.json()) as WidgetConfig;
}

export async function sendWidgetMessage(
  widgetPublicKey: string,
  body: {
    sessionId: string;
    message: string;
    widgetAgentId?: string;
    language: "sv" | "en";
    pageUrl?: string;
    referrer?: string;
  },
  context: WidgetRequestContext,
) {
  return fetch(buildWidgetUrl(widgetPublicKey, "/chat"), {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: JSON.stringify(body),
  });
}

export async function completeWidgetSession(
  widgetPublicKey: string,
  body: {
    sessionId: string;
    reason: "inactivity_timeout";
  },
  context: WidgetRequestContext,
) {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/complete"), {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return (await response.json()) as {
    ok: boolean;
    sessionCompleted: boolean;
    endReason: "assistant_suggestion" | "inactivity_timeout" | null;
  };
}


export async function sendWidgetEvent(
  widgetPublicKey: string,
  body: {
    sessionId: string;
    event: string;
    occurredAt: string;
    pageUrl?: string;
    referrer?: string;
    visibilityState?: string;
  },
  context: WidgetRequestContext,
  options?: { preferBeacon?: boolean },
) {
  const url = buildWidgetUrl(widgetPublicKey, "/events");
  const payload = JSON.stringify(body);

  if (
    options?.preferBeacon &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }

  await fetch(url, {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: payload,
    keepalive: options?.preferBeacon ?? false,
  }).catch(() => {
    // Best-effort telemetry only.
  });
}
