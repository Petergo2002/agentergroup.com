const FALLBACK_SITE_ORIGIN = "https://avenro.se";

export function getSiteOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configuredOrigin) {
    return FALLBACK_SITE_ORIGIN;
  }

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return FALLBACK_SITE_ORIGIN;
  }
}
