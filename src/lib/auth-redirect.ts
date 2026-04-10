const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";

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
