import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PROACTIVE_MESSAGE_MAX_LENGTH,
  resolveProactiveMessage,
} from "../../src/lib/widgets/proactive-message.ts";

const loader = readFileSync("apps/widget-v2/public/loader.js", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260911170000_widget_proactive_message.sql",
  "utf8",
);
const widgetSaveRoute = readFileSync(
  "src/app/api/widgets/[id]/route.ts",
  "utf8",
);

test("a disabled or blank teaser never reaches the host page", () => {
  // The message is withheld from the public bootstrap payload rather than
  // being sent and hidden client-side, so a host page cannot read copy the
  // owner has switched off.
  assert.equal(resolveProactiveMessage(false, "Hello there"), null);
  assert.equal(resolveProactiveMessage(null, "Hello there"), null);
  assert.equal(resolveProactiveMessage(undefined, "Hello there"), null);
  assert.equal(resolveProactiveMessage(true, null), null);
  assert.equal(resolveProactiveMessage(true, ""), null);
  assert.equal(resolveProactiveMessage(true, "   "), null);
  assert.equal(resolveProactiveMessage(true, "  Hi there  "), "Hi there");
});

test("the message is capped in code and in the database", () => {
  const long = "x".repeat(500);
  assert.equal(
    resolveProactiveMessage(true, long)?.length,
    PROACTIVE_MESSAGE_MAX_LENGTH,
  );
  assert.match(migration, /char_length\(proactive_message\) <= 140/);
  // Truncated on save rather than rejecting the whole widget update.
  assert.match(
    widgetSaveRoute,
    /parseString\(body\.proactiveMessage\)\?\.slice\(0, PROACTIVE_MESSAGE_MAX_LENGTH\)/,
  );
});

test("owner-authored copy is rendered as text, never as markup", () => {
  // This string is written by the workspace owner and injected into a third
  // party's page, so it must not be able to introduce markup or script.
  assert.match(loader, /text\.textContent = message;/);
  assert.doesNotMatch(loader, /teaser\.innerHTML/);
  assert.doesNotMatch(loader, /\.innerHTML = message/);
});

test("it shows once per visitor and retires on dismiss or open", () => {
  assert.match(loader, /ag_widget_teaser_seen_v1/);
  assert.match(loader, /if \(hasSeenTeaser\(\)\) return;/);
  // Dismissing and opening the chat both retire it permanently.
  assert.match(loader, /hideTeaser\(\{ remember: true \}\)/);
  assert.equal(
    loader.match(/hideTeaser\(\{ remember: true \}\)/g)?.length,
    3,
    "dismiss, keyboard/click open, and openWidget",
  );
  // Storage may be unavailable; that must not throw into the host page.
  assert.match(loader, /function hasSeenTeaser\(\)[\s\S]*?try \{[\s\S]*?\} catch \{/);
});

test("the builder preview always demonstrates the teaser", () => {
  // Otherwise the owner sees it once and can never look at it again while
  // editing the copy.
  assert.match(loader, /if \(previewEnabled\) return false;/);
  assert.match(loader, /function markTeaserSeen\(\)\s*\{\s*if \(previewEnabled\) return;/);
});

test("the one-shot is not spent while the tab is in the background", () => {
  assert.match(loader, /document\.visibilityState === "hidden"/);
  assert.match(loader, /document\.addEventListener\("visibilitychange", showWhenVisible\)/);
  // requestAnimationFrame does not fire in a hidden tab, so the reveal is
  // backed by a timeout.
  assert.match(loader, /window\.setTimeout\(reveal, 60\)/);
});

test("audio is primed on a real gesture and never breaks the host page", () => {
  // Browsers refuse to start audio before an interaction; priming on the first
  // gesture is what makes the chime work for most visitors.
  assert.match(loader, /document\.addEventListener\("pointerdown", primeOnce, true\)/);
  assert.match(loader, /document\.addEventListener\("keydown", primeOnce, true\)/);
  assert.match(loader, /if \(!audioContext \|\| audioContext\.state !== "running"\) return;/);
  assert.match(loader, /createOscillator\(\)/);
  assert.doesNotMatch(loader, /new Audio\(/);
});

test("the teaser cannot collapse against the launcher's width", () => {
  // The container is width:max-content, so an absolutely positioned child
  // shrink-to-fits and wraps one word per line without an explicit width.
  assert.match(loader, /\.ag-widget-teaser \{[\s\S]*?width: max-content;/);
  assert.match(loader, /\.ag-widget-teaser \{[\s\S]*?box-sizing: border-box;/);
  assert.match(loader, /max-width: min\(288px, calc\(100vw - 48px\)\)/);
});
