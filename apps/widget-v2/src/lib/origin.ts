export function normalizeOriginValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveEmbeddedParentOrigin(parentOrigin?: string): string | null {
  const normalizedFromProp = normalizeOriginValue(parentOrigin);
  if (normalizedFromProp) return normalizedFromProp;
  if (typeof document === "undefined") return null;
  return normalizeOriginValue(document.referrer);
}