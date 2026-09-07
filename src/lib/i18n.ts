import type { Messages } from "@/locales/en";

export const PLATFORM_LANGUAGE_STORAGE_KEY = "avenro.platform_language";
export const PLATFORM_LANGUAGE_COOKIE = "avenro_platform_language";
export const LEGACY_PLATFORM_LANGUAGE_STORAGE_KEY = "agentergroup.platform_language";
export const LEGACY_PLATFORM_LANGUAGE_COOKIE = "agentergroup_platform_language";
export const PLATFORM_LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const PLATFORM_LANGUAGES = ["en", "sv"] as const;
export type PlatformLanguage = (typeof PLATFORM_LANGUAGES)[number];
export const DEFAULT_PLATFORM_LANGUAGE: PlatformLanguage = "en";

type TranslationValues = Record<string, string | number>;

const messageLoaders: Record<PlatformLanguage, () => Promise<Messages>> = {
  en: async () => (await import("@/locales/en")).en,
  sv: async () => (await import("@/locales/sv")).sv,
};

const messageCache = new Map<PlatformLanguage, Promise<Messages>>();

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isPlatformLanguage(value: unknown): value is PlatformLanguage {
  return typeof value === "string" && PLATFORM_LANGUAGES.includes(value as PlatformLanguage);
}

export function resolvePlatformLanguage(value: unknown): PlatformLanguage {
  return isPlatformLanguage(value) ? value : DEFAULT_PLATFORM_LANGUAGE;
}

export async function getMessages(language: PlatformLanguage) {
  if (process.env.NODE_ENV === "production") {
    const cached = messageCache.get(language);
    if (cached) {
      return cached;
    }

    const next = messageLoaders[language]();
    messageCache.set(language, next);
    return next;
  }

  return messageLoaders[language]();
}

function resolveMessage(messages: Messages, key: string) {
  const segments = key.split(".");
  let current: unknown = messages;

  for (const segment of segments) {
    if (!isObjectRecord(current) || !(segment in current)) {
      return key;
    }

    current = current[segment];
  }

  return typeof current === "string" ? current : key;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    token in values ? String(values[token]) : `{${token}}`,
  );
}

export function createTranslator(messages: Messages) {
  return (key: string, values?: TranslationValues) =>
    interpolate(resolveMessage(messages, key), values);
}

export function getIntlLocale(language: PlatformLanguage) {
  return language === "sv" ? "sv-SE" : "en-US";
}

export function formatLocaleDate(
  value: string | number | Date,
  language: PlatformLanguage,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(new Date(value));
}

export function formatLocaleDateTime(
  value: string | number | Date,
  language: PlatformLanguage,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getIntlLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(new Date(value));
}

export function formatLocaleNumber(value: number, language: PlatformLanguage) {
  return new Intl.NumberFormat(getIntlLocale(language)).format(value);
}

export function formatRelativeTime(
  value: string | number | Date,
  language: PlatformLanguage,
  numeric: Intl.RelativeTimeFormatNumeric = "auto",
) {
  const formatter = new Intl.RelativeTimeFormat(language, { numeric });
  const diffSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) {
    return language === "sv" ? "precis nu" : "just now";
  }

  if (absSeconds < 60 * 60) {
    return formatter.format(Math.round(diffSeconds / 60), "minute");
  }

  if (absSeconds < 60 * 60 * 24) {
    return formatter.format(Math.round(diffSeconds / (60 * 60)), "hour");
  }

  if (absSeconds < 60 * 60 * 24 * 30) {
    return formatter.format(Math.round(diffSeconds / (60 * 60 * 24)), "day");
  }

  if (absSeconds < 60 * 60 * 24 * 365) {
    return formatter.format(Math.round(diffSeconds / (60 * 60 * 24 * 30)), "month");
  }

  return formatter.format(Math.round(diffSeconds / (60 * 60 * 24 * 365)), "year");
}
