import { getAppUrl, getWidgetAppUrl } from "@/lib/env";
import { normalizeAllowedOrigin } from "@/lib/widgets/http";
import {
  WIDGET_PREVIEW_TTL_MS,
  WIDGET_ACCESS_TTL_MS,
  type WidgetAccessTokenPayload,
  type WidgetPreviewTokenPayload,
} from "./server-types";

function getSignedTokenSecret(
  envValue: string | undefined,
  fallbackValue: string,
) {
  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  if (process.env.NODE_ENV !== "production") {
    return fallbackValue;
  }

  return null;
}

function decodeBase64Json<T>(value: string) {
  try {
    return JSON.parse(atob(value)) as T;
  } catch {
    return null;
  }
}

async function signSignedToken(payload: object, secret: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const body = btoa(JSON.stringify(payload));
  const mac = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${body}.${mac}`;
}

async function verifySignedToken<T>(token: string | null, secret: string) {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedMac] = token.split(".");

  if (!encodedPayload || !encodedMac) {
    return null;
  }

  const payload = decodeBase64Json<T>(encodedPayload);

  if (!payload) {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const macBytes = Uint8Array.from(atob(encodedMac), (char) =>
    char.charCodeAt(0),
  );
  const payloadJson = atob(encodedPayload);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    macBytes,
    encoder.encode(payloadJson),
  );

  return isValid ? payload : null;
}

export function getWidgetAccessTokenSecret() {
  return getSignedTokenSecret(
    process.env.WIDGET_ACCESS_SECRET,
    "local-widget-access-secret",
  );
}

export function getPreviewTokenSecret() {
  return getSignedTokenSecret(
    process.env.WIDGET_PREVIEW_SECRET,
    "local-widget-preview-secret",
  );
}

export async function signWidgetAccessToken(payload: WidgetAccessTokenPayload) {
  const secret = getWidgetAccessTokenSecret();

  if (!secret) {
    throw new Error(
      "WIDGET_ACCESS_SECRET is missing. Set it in production to enable widget runtime access tokens.",
    );
  }

  return signSignedToken(payload, secret);
}

export async function verifyWidgetAccessToken(
  token: string | null,
  expectedWidgetPublicKey: string,
) {
  const secret = getWidgetAccessTokenSecret();

  if (!secret) {
    return null;
  }

  const payload = await verifySignedToken<WidgetAccessTokenPayload>(token, secret);

  if (!payload) {
    return null;
  }

  if (
    payload.widgetPublicKey !== expectedWidgetPublicKey ||
    typeof payload.widgetId !== "string" ||
    (payload.source !== "embedded" && payload.source !== "hosted") ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  if (
    payload.allowedOrigin !== null &&
    normalizeAllowedOrigin(payload.allowedOrigin) !== payload.allowedOrigin
  ) {
    return null;
  }

  return payload;
}

export async function signWidgetPreviewToken(payload: Record<string, unknown>) {
  const secret = getPreviewTokenSecret();

  if (!secret) {
    throw new Error(
      "WIDGET_PREVIEW_SECRET is missing. Set it in production to enable widget preview tokens.",
    );
  }

  return signSignedToken(payload, secret);
}

export async function verifyWidgetPreviewToken(
  token: string | null,
  expectedWidgetPublicKey: string,
) {
  if (!token) {
    return false;
  }

  const secret = getPreviewTokenSecret();

  if (!secret) {
    return false;
  }

  const payload = await verifySignedToken<WidgetPreviewTokenPayload>(token, secret);

  if (!payload) {
    return null;
  }

  if (payload.widgetPublicKey !== expectedWidgetPublicKey) {
    return null;
  }

  if (
    typeof payload.expiresAt !== "number" ||
    typeof payload.issuedAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  return payload;
}

export function buildWidgetPreviewPayload(input: {
  widgetPublicKey: string;
  widgetId: string;
  workspaceId: string;
  userId: string;
  revision?: string;
  expiresInMs?: number;
}) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.expiresInMs ?? WIDGET_PREVIEW_TTL_MS);

  return {
    widgetPublicKey: input.widgetPublicKey,
    widgetId: input.widgetId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    revision: input.revision,
    appUrl: getAppUrl(),
    widgetUrl: getWidgetAppUrl(),
    issuedAt,
    expiresAt,
  };
}

export function buildWidgetAccessPayload(input: {
  widgetPublicKey: string;
  widgetId: string;
  source: "embedded" | "hosted";
  allowedOrigin: string | null;
  expiresInMs?: number;
}) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.expiresInMs ?? WIDGET_ACCESS_TTL_MS);

  return {
    widgetPublicKey: input.widgetPublicKey,
    widgetId: input.widgetId,
    source: input.source,
    allowedOrigin: input.allowedOrigin,
    issuedAt,
    expiresAt,
  } satisfies WidgetAccessTokenPayload;
}
