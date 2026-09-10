const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";
const POST_AUTH_BLOCKED_PREFIXES = ["/auth", "/login", "/signup"] as const;

// Any absolute origin works here; it only exists so the parser has something to
// resolve against. A value that escapes to a different origin is rejected.
const REDIRECT_RESOLUTION_BASE = "https://redirect.invalid";

// Browsers strip tabs, newlines and other C0 control characters before parsing
// a URL, so "/\t/evil.com" reaches the network as "//evil.com". Remove them
// first so the value being judged is the value the browser will actually see.
const URL_STRIPPED_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function sanitizeRedirectTo(
  value: string | null | undefined,
  fallback = DEFAULT_POST_LOGIN_REDIRECT,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim().replace(URL_STRIPPED_CONTROL_CHARACTERS, "");

  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Resolve with the same URL parser the browser uses rather than pattern
  // matching. That covers "//evil.com", "/\evil.com" (backslashes normalise to
  // slashes in special schemes), and other host-escaping forms in one check.
  let resolved: URL;
  try {
    resolved = new URL(trimmed, REDIRECT_RESOLUTION_BASE);
  } catch {
    return fallback;
  }

  if (resolved.origin !== REDIRECT_RESOLUTION_BASE) {
    return fallback;
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function sanitizePostAuthRedirectTo(
  value: string | null | undefined,
  fallback = DEFAULT_POST_LOGIN_REDIRECT,
) {
  const redirectTo = sanitizeRedirectTo(value, fallback);
  const pathname = redirectTo.split(/[?#]/, 1)[0] ?? redirectTo;

  if (POST_AUTH_BLOCKED_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))) {
    return fallback;
  }

  return redirectTo;
}
