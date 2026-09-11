import { useCallback, useState } from "react";

const SESSION_KEY_PREFIX = "ag_widget_session_v2";
const VISITOR_KEY_PREFIX = "ag_widget_visitor_v1";
const LEGACY_STORAGE_PREFIXES = [
  "ag_widget_session_timestamp_v2",
  "ag_widget_session",
  "ag_widget_session_timestamp",
];

function getSessionKey(widgetPublicKey: string) {
  return `${SESSION_KEY_PREFIX}_${widgetPublicKey}`;
}

/**
 * Preview and live runtimes keep separate visitor identities so builder preview
 * history never mixes with the conversations a real visitor had on the site.
 */
function getVisitorKey(widgetPublicKey: string, scope: WidgetVisitorScope) {
  return scope === "preview"
    ? `${VISITOR_KEY_PREFIX}_preview_${widgetPublicKey}`
    : `${VISITOR_KEY_PREFIX}_${widgetPublicKey}`;
}

function buildSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session_${crypto.randomUUID()}`;
  }

  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

function buildVisitorToken() {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    return `${buildSessionId()}_${buildSessionId()}`.replace(/[^A-Za-z0-9_-]/g, "");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readOrCreateVisitorToken(
  widgetPublicKey: string,
  scope: WidgetVisitorScope,
) {
  if (typeof window === "undefined") return buildVisitorToken();

  const key = getVisitorKey(widgetPublicKey, scope);
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const token = buildVisitorToken();
    localStorage.setItem(key, token);
    return token;
  } catch {
    return buildVisitorToken();
  }
}

function readOrCreatePersistentSession(widgetPublicKey: string): string {
  if (typeof window === "undefined") return buildSessionId();

  const sessionKey = getSessionKey(widgetPublicKey);
  try {
    const persistentSession = localStorage.getItem(sessionKey);
    if (persistentSession) return persistentSession;

    const tabSession = sessionStorage.getItem(sessionKey);
    if (tabSession) {
      localStorage.setItem(sessionKey, tabSession);
      return tabSession;
    }

    for (const prefix of LEGACY_STORAGE_PREFIXES) {
      localStorage.removeItem(`${prefix}_${widgetPublicKey}`);
    }

    const newSession = buildSessionId();
    localStorage.setItem(sessionKey, newSession);
    sessionStorage.setItem(sessionKey, newSession);
    return newSession;
  } catch {
    return buildSessionId();
  }
}

export type WidgetVisitorScope = "live" | "preview";

interface UseSessionOptions {
  persist?: boolean;
}

export function useSession(
  widgetPublicKey: string,
  options?: UseSessionOptions,
) {
  const persist = options?.persist !== false;
  const [sessionId, setSessionId] = useState(() =>
    persist ? readOrCreatePersistentSession(widgetPublicKey) : buildSessionId(),
  );
  // The session id stays tab-local in preview (each builder revision starts a
  // fresh chat), but the visitor identity is always persisted so previously
  // previewed conversations remain reachable from the history list.
  const [visitorToken] = useState(() =>
    readOrCreateVisitorToken(widgetPublicKey, persist ? "live" : "preview"),
  );

  const reset = useCallback(() => {
    const nextSession = resetSession(widgetPublicKey, persist);
    setSessionId(nextSession);
    return nextSession;
  }, [persist, widgetPublicKey]);

  const select = useCallback(
    (nextSessionId: string) => {
      if (persist && typeof window !== "undefined") {
        try {
          localStorage.setItem(getSessionKey(widgetPublicKey), nextSessionId);
          sessionStorage.setItem(getSessionKey(widgetPublicKey), nextSessionId);
        } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
        }
      }
      setSessionId(nextSessionId);
    },
    [persist, widgetPublicKey],
  );

  return {
    sessionId,
    visitorToken,
    reset,
    select,
  };
}

export function resetSession(widgetPublicKey: string, persist = true): string {
  const nextSession = buildSessionId();
  if (!persist || typeof window === "undefined") {
    return nextSession;
  }

  try {
    localStorage.setItem(getSessionKey(widgetPublicKey), nextSession);
    sessionStorage.setItem(getSessionKey(widgetPublicKey), nextSession);
  } catch {
    // Continue with an in-memory session when persistent storage is blocked.
  }
  return nextSession;
}

export function clearSession(widgetPublicKey: string) {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(getSessionKey(widgetPublicKey));
  localStorage.removeItem(getSessionKey(widgetPublicKey));
  for (const prefix of LEGACY_STORAGE_PREFIXES) {
    localStorage.removeItem(`${prefix}_${widgetPublicKey}`);
  }
}
