import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  contrastRatio,
  pickReadableTextColor,
  pickVisibleIconColor,
} from "../../src/lib/widgets/contrast.ts";

const preview = readFileSync(
  "src/components/widgets/builder/WidgetDevicePreview.tsx",
  "utf8",
);
const loader = readFileSync("apps/widget-v2/public/loader.js", "utf8");

test("a white brand colour flips the text to dark", () => {
  // The reported bug: picking white gave white text on a white launcher.
  assert.equal(pickReadableTextColor("#ffffff"), "#111111");
  assert.equal(pickReadableTextColor("#fff"), "#111111");
  assert.equal(pickReadableTextColor("#fafafa"), "#111111");
});

test("a dark brand colour keeps light text", () => {
  assert.equal(pickReadableTextColor("#000000"), "#ffffff");
  assert.equal(pickReadableTextColor("#1b1b1f"), "#ffffff");
});

test("the brand orange takes dark text, because white fails contrast on it", () => {
  // Measured: white scores 3.10 against #ff5c02 and fails AA, while near-black
  // scores 6.10. The shipped launcher already does this, so the preview showing
  // white text on orange was the preview being wrong, not the rule.
  assert.ok(contrastRatio("#ffffff", "#ff5c02") < 4.5);
  assert.ok(contrastRatio("#111111", "#ff5c02") > 4.5);
  assert.equal(pickReadableTextColor("#ff5c02"), "#111111");
});

test("the preferred text colour follows the widget theme, as loader.js does", () => {
  // loader.js: themeMode === "light" ? "#171717" : "#f5f5f5", then overridden
  // when that fails contrast. A mid-dark brand keeps the theme's own choice.
  assert.equal(pickReadableTextColor("#1b1b1f", "#f5f5f5"), "#f5f5f5");
  assert.equal(pickReadableTextColor("#fafafa", "#171717"), "#171717");
});

test("a preferred colour is kept only while it clears AA", () => {
  // Brand colours that already work with white text should not be second-guessed.
  assert.equal(pickReadableTextColor("#0b3d2e", "#ffffff"), "#ffffff");
  // ...but a preference that fails contrast is overridden, not honoured.
  assert.equal(pickReadableTextColor("#ffff00", "#ffffff"), "#111111");
});

test("mid-tone brand colours resolve to whichever side reads better", () => {
  for (const color of ["#808080", "#6b7280", "#facc15", "#22c55e", "#3b82f6"]) {
    const fg = pickReadableTextColor(color);
    const chosen = contrastRatio(fg, color);
    const other = contrastRatio(fg === "#ffffff" ? "#111111" : "#ffffff", color);
    assert.ok(
      chosen >= other,
      `${color} picked ${fg} at ${chosen.toFixed(2)} over ${other.toFixed(2)}`,
    );
  }
});

test("the mark stays visible when the brand colour is near-white", () => {
  // The logo sits on a white circle, so a white brand colour would vanish.
  assert.equal(pickVisibleIconColor("#ffffff"), "#111111");
  assert.equal(pickVisibleIconColor("#ff5c02"), "#ff5c02");
});

test("malformed colours fall back instead of throwing", () => {
  // The field is free text, so a half-typed value must not crash the preview.
  for (const value of ["", "#", "nonsense", "#12", "rgb(0,0,0)"]) {
    assert.doesNotThrow(() => pickReadableTextColor(value));
    assert.doesNotThrow(() => pickVisibleIconColor(value));
  }
});

test("the builder preview no longer hardcodes white on the launcher", () => {
  // It exists to show what the launcher will look like, so hardcoding a
  // foreground made it lie the moment a light brand colour was chosen.
  const launcher = preview.slice(preview.indexOf("Canonical Closed State"));
  assert.doesNotMatch(launcher, /text-white/);
  assert.doesNotMatch(launcher, /bg-white\/30/);
  assert.match(preview, /color: launcherFg/);
  assert.match(preview, /pickVisibleIconColor/);
});

test("the preview and the shipped launcher use the same rule", () => {
  // loader.js is canonical. If these drift, the preview stops predicting the
  // launcher, which is the whole reason the preview exists.
  for (const marker of ["0.2126", "0.7152", "0.0722", ">= 4.5"]) {
    assert.ok(loader.includes(marker), `loader.js lost ${marker}`);
  }
  const helper = readFileSync("src/lib/widgets/contrast.ts", "utf8");
  for (const marker of ["0.2126", "0.7152", "0.0722"]) {
    assert.ok(helper.includes(marker), `helper lost ${marker}`);
  }
  assert.match(helper, /MIN_TEXT_CONTRAST = 4\.5/);
});
