export function normalizePrivacyEmail(value: string) {
  return value.trim().toLowerCase();
}

export function matchesExactNormalizedEmail(
  candidate: string | null | undefined,
  query: string,
) {
  if (!candidate) {
    return false;
  }

  return normalizePrivacyEmail(candidate) === normalizePrivacyEmail(query);
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function buildEscapedIlikeContainsPattern(value: string) {
  return `%${escapeLikePattern(value)}%`;
}

export function sanitizeContentDispositionToken(
  value: string | null | undefined,
  fallback = "session",
) {
  const sanitized = (value ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || fallback;
}
