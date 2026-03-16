import { useCallback, useState } from "react";

const SESSION_KEY_PREFIX = "ag_widget_session_v2";
const LEGACY_STORAGE_PREFIXES = [
  "ag_widget_session_timestamp_v2",
  "ag_widget_session",
  "ag_widget_session_timestamp",
];

function getSessionKey(widgetPublicKey: string) {
  return `${SESSION_KEY_PREFIX}_${widgetPublicKey}`;
}

function buildSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function readOrCreatePersistentSession(widgetPublicKey: string): string {
  if (typeof window === "undefined") return buildSessionId();

  const sessionKey = getSessionKey(widgetPublicKey);
  const existingSession = sessionStorage.getItem(sessionKey);
  if (existingSession) return existingSession;

  for (const prefix of LEGACY_STORAGE_PREFIXES) {
    localStorage.removeItem(`${prefix}_${widgetPublicKey}`);
  }

  const newSession = buildSessionId();
  sessionStorage.setItem(sessionKey, newSession);
  return newSession;
}

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

  const reset = useCallback(() => {
    const nextSession = resetSession(widgetPublicKey, persist);
    setSessionId(nextSession);
    return nextSession;
  }, [persist, widgetPublicKey]);

  return {
    sessionId,
    reset,
  };
}

export function resetSession(widgetPublicKey: string, persist = true): string {
  const nextSession = buildSessionId();
  if (!persist || typeof window === "undefined") {
    return nextSession;
  }

  sessionStorage.setItem(getSessionKey(widgetPublicKey), nextSession);
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
