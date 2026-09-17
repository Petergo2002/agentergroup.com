export type LanguagePreference = "sv" | "en";

export function validLanguage(value: unknown): value is LanguagePreference {
  return value === "sv" || value === "en";
}

export function resolveStoredLanguage(current: unknown, legacy: unknown, initial: LanguagePreference): LanguagePreference {
  return validLanguage(current) ? current : validLanguage(legacy) ? legacy : initial;
}

export function resolveRequestLanguage(current: unknown, legacy: unknown, url?: string | null): LanguagePreference {
  if (validLanguage(current)) return current;
  if (validLanguage(legacy)) return legacy;
  try {
    if (url && new URL(url).pathname === "/") return "sv";
  } catch { /* An absent or malformed request URL uses the platform default. */ }
  return "en";
}
