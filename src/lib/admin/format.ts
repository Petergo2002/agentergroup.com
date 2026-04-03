import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleNumber,
  formatRelativeTime,
  type PlatformLanguage,
} from "@/lib/i18n";

export function formatAdminNumber(value: number, language: PlatformLanguage = "en") {
  return formatLocaleNumber(value, language);
}

export function formatAdminDate(value: string, language: PlatformLanguage = "en") {
  return formatLocaleDate(value, language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAdminDateTime(
  value: string | null,
  language: PlatformLanguage = "en",
) {
  if (!value) return language === "sv" ? "Aldrig" : "Never";
  return formatLocaleDateTime(value, language);
}

export function formatAdminRelativeTime(
  value: string | null,
  language: PlatformLanguage = "en",
) {
  if (!value) return language === "sv" ? "Aldrig" : "Never";
  return formatRelativeTime(value, language);
}

export function getAdminActivityState(value: string | null) {
  if (!value) return "inactive" as const;
  const diffMs = Date.now() - new Date(value).getTime();
  return diffMs <= 7 * 24 * 60 * 60 * 1000 ? ("active" as const) : ("inactive" as const);
}
