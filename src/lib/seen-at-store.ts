/**
 * Tiny external store over the "last seen" timestamps that drive the sidebar
 * attention badges. These live in localStorage so they survive reloads, and
 * reading them through useSyncExternalStore keeps the value out of component
 * state — mirroring localStorage into useState forces a setState inside an
 * effect, which cascades renders and is rejected by the React Compiler lint.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToSeenAt(listener: () => void) {
  listeners.add(listener);

  // The storage event only fires for other tabs, so same-tab writes go through
  // emit() instead. Both paths land on the same listener.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function readSeenAt(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch {
    // Safari private mode and blocked third-party storage both throw here.
    return null;
  }
}

/** Server snapshot: nothing is "seen" until the browser tells us otherwise. */
export function readSeenAtOnServer(): string | null {
  return null;
}

export function markSeenNow(key: string, now = new Date().toISOString()) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, now);
    } catch {
      // A failed write just means the badge reappears on the next load.
    }
  }

  emit();
  return now;
}
