const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";
const POST_AUTH_BLOCKED_PREFIXES = ["/auth", "/login", "/signup"] as const;

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

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
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
