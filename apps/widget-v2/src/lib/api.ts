import type { WidgetBootstrapResponse, WidgetConfig } from "../types";

/** Public API helpers used by the standalone widget runtime. */

export interface WidgetRequestContext {
  accessToken?: string | null;
  previewToken?: string;
  previewSource?: string;
  previewRevision?: string;
}

/**
 * Resolves the API origin the widget should talk to.
 *
 * @returns The widget API base URL.
 */
export function resolveWidgetApiBase(): string {
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

  return "https://avenro.se";
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
  const retryAfterHeader = response.headers.get("Retry-After");
  const error = new Error(message) as Error & {
    code?: string;
    retryAfterSeconds?: number;
    status?: number;
  };
  if (typeof payload?.code === "string") {
    error.code = payload.code;
  }
  const retryAfterSeconds =
    typeof payload?.retryAfterSeconds === "number"
      ? payload.retryAfterSeconds
      : retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : null;
  if (typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  error.status = response.status;
  throw error;
}

function buildWidgetUrl(widgetPublicKey: string, path: string) {
  return `${getApiBase()}/api/public/widgets/${encodeURIComponent(widgetPublicKey)}${path}`;
}

export async function getWidgetBootstrap(
  widgetPublicKey: string,
  context: WidgetRequestContext,
): Promise<WidgetBootstrapResponse> {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/bootstrap"), {
    headers: buildWidgetHeaders(context, { includeContentType: false }),
    cache: context.previewToken ? "no-store" : "default",
  });

  if (!response.ok) {
    await parseError(response);
  }

  return (await response.json()) as WidgetBootstrapResponse;
}

export async function getWidgetConfig(
  widgetPublicKey: string,
  context: WidgetRequestContext,
): Promise<WidgetConfig> {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/config"), {
    headers: buildWidgetHeaders(context, { includeContentType: false }),
    cache: context.previewToken ? "no-store" : "default",
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
    attachments?: {
      id: string;
      url: string;
      name: string;
      type: string;
      size: number;
    }[];
  },
  context: WidgetRequestContext,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  return fetch(buildWidgetUrl(widgetPublicKey, "/chat"), {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: JSON.stringify(body),
    signal: options?.signal,
  });
}

export async function uploadWidgetAttachment(
  widgetPublicKey: string,
  sessionId: string,
  file: File,
  context: WidgetRequestContext,
): Promise<{
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}> {
  const formData = new FormData();
  formData.append("sessionId", sessionId);
  formData.append("file", file);

  const headers = buildWidgetHeaders(context, { includeContentType: false });
  // Browser will set Content-Type automatically for FormData

  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/upload"), {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error || `Upload failed with status ${response.status}.`;
    throw new Error(message);
  }

  return response.json();
}

export async function completeWidgetSession(
  widgetPublicKey: string,
  body: {
    sessionId: string;
    reason: "inactivity_timeout";
  },
  context: WidgetRequestContext,
): Promise<{
  ok: boolean;
  sessionCompleted: boolean;
  endReason: "assistant_suggestion" | "inactivity_timeout" | null;
}> {
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
): Promise<void> {
  const url = buildWidgetUrl(widgetPublicKey, "/events");
  const payload = JSON.stringify(body);

  await fetch(url, {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: payload,
    keepalive: options?.preferBeacon ?? false,
  }).catch(() => {
    // Best-effort telemetry only.
  });
}

export async function submitWidgetLead(
  widgetPublicKey: string,
  body: {
    sessionId: string;
    name: string;
    email: string;
    phone?: string;
    message?: string;
    widgetAgentId?: string;
  },
  context: WidgetRequestContext,
): Promise<{ ok: boolean; leadId: string; createdAt: string }> {
  const response = await fetch(buildWidgetUrl(widgetPublicKey, "/leads"), {
    method: "POST",
    headers: buildWidgetHeaders(context),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return (await response.json()) as { ok: boolean; leadId: string; createdAt: string };
}
