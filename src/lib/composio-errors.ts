function collectErrorText(
  value: unknown,
  fragments: Set<string>,
  seen: Set<unknown>,
) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) {
      fragments.add(normalized);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (value instanceof Error) {
    collectErrorText(value.message, fragments, seen);
    const cause = (value as Error & { cause?: unknown }).cause;
    if (cause) {
      collectErrorText(cause, fragments, seen);
    }
  }

  const record = value as Record<string, unknown>;
  for (const key of ["message", "slug", "code", "suggested_fix"]) {
    collectErrorText(record[key], fragments, seen);
  }

  collectErrorText(record.error, fragments, seen);
  collectErrorText(record.cause, fragments, seen);
}

function getComposioErrorText(error: unknown) {
  const fragments = new Set<string>();
  collectErrorText(error, fragments, new Set<unknown>());
  return Array.from(fragments).join(" ");
}

export function isConnectedAccountMissingError(error: unknown) {
  const normalized = getComposioErrorText(error).toLowerCase();

  return (
    normalized.includes("connectedaccountnotfound") ||
    normalized.includes("actionexecute_connectedaccountnotfound") ||
    normalized.includes("no connected account found") ||
    (normalized.includes("connected account") &&
      normalized.includes("was not found or may have been deleted"))
  );
}

export function isComposioAuthenticationError(error: unknown) {
  const normalized = getComposioErrorText(error).toLowerCase();

  return (
    normalized.includes("http_unauthorized") ||
    normalized.includes("invalid api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("status\":401") ||
    normalized.includes("status 401") ||
    normalized.includes("code\":10401") ||
    normalized.includes("code 10401")
  );
}
