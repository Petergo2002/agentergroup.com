/**
 * Readable colours on top of a customer-chosen brand colour.
 *
 * These mirror `pickReadableTextColor` and `pickVisibleIconColor` in
 * `apps/widget-v2/public/loader.js`, which is the canonical implementation —
 * the shipped launcher already adapts correctly. The builder preview could not
 * import from it (separate build, plain JS), so it hardcoded `text-white` and
 * drew white-on-white the moment someone picked a light brand colour.
 *
 * Keep the two in step: the preview exists to show what the launcher will
 * actually look like, so a difference here is the preview lying.
 */

const WHITE = "#ffffff";
const DARK = "#111111";
/** WCAG AA for normal text. Below this, the preferred colour is not usable. */
const MIN_TEXT_CONTRAST = 4.5;
/**
 * A mark on a white circle only has to be *visible*, not text-legible, so it
 * uses a far lower bar than body text before falling back to near-black.
 */
const MIN_ICON_CONTRAST = 1.5;

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
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

function relativeLuminance(hex: string) {
  const safeHex = normalizeHexColor(hex, "#000000").slice(1);
  const channels = [
    Number.parseInt(safeHex.slice(0, 2), 16),
    Number.parseInt(safeHex.slice(2, 4), 16),
    Number.parseInt(safeHex.slice(4, 6), 16),
  ];

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * toLinear(channels[0]) +
    0.7152 * toLinear(channels[1]) +
    0.0722 * toLinear(channels[2])
  );
}

export function contrastRatio(a: string, b: string) {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Text that stays readable on `background`.
 *
 * Keeps `preferred` when it already clears AA, so a brand that works with white
 * text keeps white text; otherwise it takes whichever of white or near-black
 * reads better. That is what makes a white brand colour flip to dark text.
 */
export function pickReadableTextColor(background: string, preferred = WHITE) {
  const normalizedPreferred = normalizeHexColor(preferred, WHITE);

  if (contrastRatio(normalizedPreferred, background) >= MIN_TEXT_CONTRAST) {
    return normalizedPreferred;
  }

  return contrastRatio(WHITE, background) >= contrastRatio(DARK, background)
    ? WHITE
    : DARK;
}

/** A mark that stays visible when drawn on a white surface. */
export function pickVisibleIconColor(primaryColor: string) {
  return contrastRatio(primaryColor, WHITE) >= MIN_ICON_CONTRAST
    ? primaryColor
    : DARK;
}
