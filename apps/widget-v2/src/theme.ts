/** Theme helpers for deriving the widget palette from brand inputs. */
type RGB = {
  r: number;
  g: number;
  b: number;
};

export type WidgetPalette = {
  bg: string;
  bgGradient: string;
  fg: string;
  card: string;
  cardHover: string;
  border: string;
  muted: string;
  primary: string;
  primaryFg: string;
  secondary: string;
  accentStrong: string;
  accentStrongFg: string;
  accentSoft: string;
  stateHover: string;
  stateSelected: string;
  stateSelectedBorder: string;
  stateSelectedText: string;
  stateSelectedIcon: string;
  focusRing: string;
  inputSurface: string;
  inputSurfaceHover: string;
  inputBorderFocus: string;
  primaryGlow: string;
  isDark: boolean;
};

export type WidgetThemeMode = "dark" | "light";

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(
  value: string | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[\da-fA-F]{3}$/.test(withoutHash)) {
    return `#${withoutHash
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[\da-fA-F]{6}$/.test(withoutHash)) {
    return `#${withoutHash.toLowerCase()}`;
  }

  return fallback;
}

function hexToRgb(hex: string): RGB {
  const safeHex = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(safeHex.slice(0, 2), 16),
    g: Number.parseInt(safeHex.slice(2, 4), 16),
    b: Number.parseInt(safeHex.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: RGB): string {
  const toHex = (channel: number) =>
    clampChannel(channel).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixColors(base: string, overlay: string, amount: number): string {
  const safeAmount = Math.max(0, Math.min(1, amount));
  const a = hexToRgb(base);
  const b = hexToRgb(overlay);
  return rgbToHex({
    r: a.r + (b.r - a.r) * safeAmount,
    g: a.g + (b.g - a.g) * safeAmount,
    b: a.b + (b.b - a.b) * safeAmount,
  });
}

function toAlpha(hex: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.072 * srgbToLinear(rgb.b)
  );
}

function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableTextColorOnPrimary(primary: string): string {
  const white = "#ffffff";
  const black = "#111111";
  const whiteContrast = contrastRatio(white, primary);
  const blackContrast = contrastRatio(black, primary);
  if (whiteContrast >= 4.5) return white;
  if (blackContrast >= 4.5) return black;
  return whiteContrast >= blackContrast ? white : black;
}

function deriveNeutralSurface(
  bg: string,
  fg: string,
  amount: number,
): string {
  return mixColors(bg, fg, amount);
}

const DARK_PALETTE = {
  /* Premium deep dark - no harsh whites or gradients */
  bg: "#060606",
  bgGradient: "linear-gradient(180deg, #0e0e0e 0%, #070707 60%, #030303 100%)",
  fg: "#e8e8e8",
  card: "rgba(255,255,255,0.04)",
  cardHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.07)",
  muted: "#666666",
};

const LIGHT_PALETTE = {
  bg: "#ffffff",
  bgGradient: "linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
  fg: "#171717",
  card: "rgba(0,0,0,0.04)",
  cardHover: "rgba(0,0,0,0.08)",
  border: "rgba(0,0,0,0.08)",
  muted: "#6b7280",
};

/** Builds the runtime palette from the configured brand colors and theme mode. */
export function deriveWidgetPalette(
  brandColor: string | undefined,
  secondaryColor: string | undefined,
  themeMode: WidgetThemeMode,
): WidgetPalette {
  const primary = normalizeHexColor(brandColor, "#c4571f");
  const secondary = normalizeHexColor(secondaryColor, primary);
  const isDark = themeMode === "dark";
  const base = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const primaryContrastOnBg = contrastRatio(primary, base.bg);
  const canUsePrimaryAsAccent = primaryContrastOnBg >= (isDark ? 2.2 : 2.35);
  const secondaryContrastOnBg = contrastRatio(secondary, base.bg);
  const canUseSecondaryAsStateTint =
    secondaryContrastOnBg >= (isDark ? 1.22 : 1.3);

  const accentStrong = canUsePrimaryAsAccent
    ? primary
    : mixColors(base.fg, primary, isDark ? 0.24 : 0.08);
  const accentStrongFg = pickReadableTextColorOnPrimary(accentStrong);
  const secondaryTint = canUseSecondaryAsStateTint
    ? secondary
    : mixColors(accentStrong, base.fg, isDark ? 0.18 : 0.1);

  const neutralSelectedBorder = deriveNeutralSurface(
    base.bg,
    base.fg,
    isDark ? 0.2 : 0.12,
  );

  const accentSoft = mixColors(base.bg, secondaryTint, isDark ? 0.17 : 0.105);
  const stateHover = mixColors(base.bg, secondaryTint, isDark ? 0.11 : 0.06);
  const stateSelected = mixColors(base.bg, secondaryTint, isDark ? 0.2 : 0.115);
  const stateSelectedBorder = mixColors(
    base.bg,
    secondaryTint,
    isDark ? 0.32 : 0.22,
  );
  const inputSurface = deriveNeutralSurface(base.bg, base.fg, isDark ? 0.05 : 0.02);
  const inputSurfaceHover = mixColors(
    base.bg,
    secondaryTint,
    isDark ? 0.1 : 0.05,
  );
  const inputBorderFocus = canUsePrimaryAsAccent
    ? mixColors(base.bg, accentStrong, isDark ? 0.36 : 0.24)
    : neutralSelectedBorder;
  const focusRing = toAlpha(secondaryTint, isDark ? 0.28 : 0.18);

  return {
    bg: base.bg,
    bgGradient: base.bgGradient,
    fg: base.fg,
    card: base.card,
    cardHover: base.cardHover,
    border: base.border,
    muted: base.muted,
    primary,
    primaryFg: pickReadableTextColorOnPrimary(primary),
    secondary,
    accentStrong,
    accentStrongFg,
    accentSoft,
    stateHover,
    stateSelected,
    stateSelectedBorder,
    stateSelectedText: accentStrong,
    stateSelectedIcon: accentStrong,
    focusRing,
    inputSurface,
    inputSurfaceHover,
    inputBorderFocus,
    primaryGlow: toAlpha(accentStrong, 0.25),
    isDark,
  };
}

/** Infers the closest widget theme mode from the configured background color. */
export function detectThemeFromColors(
  backgroundColor: string | undefined,
): WidgetThemeMode {
  const bg = normalizeHexColor(backgroundColor, "#ffffff");
  return relativeLuminance(bg) < 0.45 ? "dark" : "light";
}

export {
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  mixColors,
  relativeLuminance,
  contrastRatio,
};
