/**
 * Brand tokens for transactional email.
 *
 * Mirrors the dashboard palette in `src/app/globals.css` so an email reads as
 * the same product as the app. Values are literal hex strings — email clients
 * strip CSS custom properties, so every colour has to be inlined at render
 * time.
 */

export const emailTheme = {
  color: {
    /** Page canvas behind the card. */
    canvas: "#fafaf9",
    card: "#ffffff",
    muted: "#f6f2ee",
    border: "#e7e1db",
    borderStrong: "#d6d0c8",
    ink: "#181818",
    body: "#667085",
    /** Tertiary text. Darker than the app's `--text-tertiary` so 12px footer copy clears WCAG AA. */
    subtle: "#6b7484",
    brand: "#ff5c02",
    brandSoft: "#fff4ec",
    brandStrong: "#b93800",
    /** Link orange. Brand `#ff5c02` only hits 3.1:1 on white, which fails AA for body text. */
    link: "#c2410c",
    brandBorder: "#ffd7bd",
    /** Dashboard's primary action colour — near-black, brand orange is the accent. */
    action: "#181818",
    actionText: "#ffffff",
    dark: {
      canvas: "#0c0c0e",
      card: "#141417",
      muted: "#1d1d23",
      border: "#26262c",
      ink: "#f4f4f5",
      body: "#94949e",
      subtle: "#8a8a94",
      brand: "#ff7a29",
      link: "#ff7a29",
      brandSoft: "#2e150a",
      brandBorder: "#4a2211",
      action: "#f4f4f5",
      actionText: "#0c0c0e",
    },
  },
  font: {
    sans:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    mono:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  /** Outlook caps reliable rendering around 600px. */
  width: 600,
  radius: {
    card: 14,
    control: 10,
    chip: 999,
  },
} as const;

/** Company identity shown in every footer. */
export const emailBrand = {
  name: "Avenro",
  tagline: "AI agents for customer conversations",
  supportEmail: "info@avenro.se",
  /** Logo is 399x132; displayed at 132px wide so it stays crisp on retina. */
  logo: {
    width: 132,
    height: 44,
    lightPath: "/email/avenro-logo.png",
    darkPath: "/email/avenro-logo-dark.png",
  },
} as const;

/**
 * Resolves the absolute origin used for images and links inside emails.
 *
 * Email clients cannot load `localhost`, so a local dev run falls back to the
 * production origin for assets — otherwise every test send arrives with a
 * broken logo.
 *
 * @param appUrl - The configured dashboard origin.
 * @returns An origin that is reachable from a mail client.
 */
export function resolveEmailAssetOrigin(appUrl: string): string {
  const configured = process.env.EMAIL_ASSET_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const normalized = appUrl.replace(/\/+$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(normalized)) {
    return "https://avenro.se";
  }

  return normalized;
}
