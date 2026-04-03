import {
  formatLocaleDate,
  type PlatformLanguage,
} from "@/lib/i18n";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function titleFromEmail(email?: string | null) {
  if (!email) {
    return "Agentergroup";
  }

  const [prefix] = email.split("@");
  const cleaned = prefix.replace(/[._-]+/g, " ").trim();

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRelativeDate(
  value?: string | null,
  language: PlatformLanguage = "en",
) {
  if (!value) {
    return language === "sv" ? "Aldrig" : "Never";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return language === "sv" ? "Precis nu" : "Just now";
  }

  if (diffMinutes < 60) {
    return language === "sv" ? `${diffMinutes} min sedan` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return language === "sv" ? `${diffHours} h sedan` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return language === "sv" ? `${diffDays} d sedan` : `${diffDays}d ago`;
  }

  return formatLocaleDate(date, language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
