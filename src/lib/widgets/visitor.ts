import { createHash } from "node:crypto";

export const WIDGET_VISITOR_TOKEN_HEADER = "x-ag-widget-visitor-token";
export const WIDGET_VISITOR_TOKEN_MIN_LENGTH = 32;
export const WIDGET_VISITOR_TOKEN_MAX_LENGTH = 128;

const WIDGET_VISITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function normalizeWidgetVisitorToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();
  if (
    token.length < WIDGET_VISITOR_TOKEN_MIN_LENGTH ||
    token.length > WIDGET_VISITOR_TOKEN_MAX_LENGTH ||
    !WIDGET_VISITOR_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  return token;
}

export function readWidgetVisitorToken(request: { headers: Headers }) {
  return normalizeWidgetVisitorToken(
    request.headers.get(WIDGET_VISITOR_TOKEN_HEADER),
  );
}

export function hashWidgetVisitorToken(widgetId: string, token: string) {
  return createHash("sha256")
    .update(`widget-visitor-v1:${widgetId}:${token}`)
    .digest("hex");
}

export function canAccessWidgetSession(
  storedVisitorTokenHash: string | null | undefined,
  requestVisitorTokenHash: string | null,
) {
  return (
    !storedVisitorTokenHash ||
    storedVisitorTokenHash === requestVisitorTokenHash
  );
}

export function buildConversationTitle(message: string, maxLength = 72) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New conversation";
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function buildConversationPreview(message: string, maxLength = 120) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
