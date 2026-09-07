export const WIDGET_DEFAULTS: Record<
  "sv" | "en",
  {
    agentLabel: string;
    greeting: string;
    placeholder: string;
    homeTitle: string;
    greetingFallback: string;
    placeholderFallback: string;
  }
> = {
  sv: {
    agentLabel: "AI-Agent",
    greeting: "Hej! Hur kan jag hjälpa dig idag?",
    greetingFallback: "Hi! How can I help you today?",
    placeholder: "Skriv ett meddelande...",
    placeholderFallback: "Write a message...",
    homeTitle: "Hur kan vi hjälpa till?",
  },
  en: {
    agentLabel: "AI Agent",
    greeting: "Hi! How can I help you today?",
    greetingFallback: "Hej! Hur kan jag hjälpa dig idag?",
    placeholder: "Write a message...",
    placeholderFallback: "Skriv ett meddelande...",
    homeTitle: "How can we help?",
  },
};

export type WidgetDefaultsKey = keyof typeof WIDGET_DEFAULTS["en"];

export function detectBrowserLanguage(): "sv" | "en" {
  if (typeof navigator !== "undefined") {
    const browserLanguage = navigator.language?.toLowerCase() || "";
    if (browserLanguage.startsWith("sv")) return "sv";
  }

  return "en";
}

export function getLocalizedText(
  value: string | null | undefined,
  key: WidgetDefaultsKey,
  language: "sv" | "en"
): string {
  const trimmed = value?.trim() ?? "";
  const targetDefault = WIDGET_DEFAULTS[language][key];
  const enDefault = WIDGET_DEFAULTS["en"][key];
  const svDefault = WIDGET_DEFAULTS["sv"][key];

  // If empty, or matches ANY of the standard defaults, replace with the target language's default
  if (!trimmed || trimmed === enDefault || trimmed === svDefault) {
    return targetDefault;
  }

  // Otherwise it's custom admin text, keep it!
  return trimmed;
}

export function formatRetryAfterDelay(
  language: "sv" | "en",
  retryAfterSeconds: number,
) {
  if (retryAfterSeconds >= 60) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return language === "sv"
      ? `${minutes} ${minutes === 1 ? "minut" : "minuter"}`
      : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return language === "sv"
    ? `${retryAfterSeconds} ${retryAfterSeconds === 1 ? "sekund" : "sekunder"}`
    : `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`;
}

export function buildChatRateLimitMessage(
  language: "sv" | "en",
  retryAfterSeconds: number | null,
) {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    const delay = formatRetryAfterDelay(language, retryAfterSeconds);
    return language === "sv"
      ? `Det går lite för snabbt just nu. Vänta ${delay} och försök igen.`
      : `You're sending messages too quickly right now. Please wait ${delay} and try again.`;
  }

  return language === "sv"
    ? "Det går lite för snabbt just nu. Vänta en stund och försök igen."
    : "You're sending messages too quickly right now. Please wait a moment and try again.";
}

export function buildLocalizedPrivacyPolicyUrl(
  value: string | null | undefined,
  language: "sv" | "en",
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://avenro.se";
    const parsed = new URL(trimmed, base);

    if (parsed.pathname === "/privacy-policy") {
      parsed.searchParams.set("lang", language);
    }

    return parsed.toString();
  } catch {
    return trimmed;
  }
}