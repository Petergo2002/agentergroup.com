import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync(
  "src/components/widgets/builder/WidgetDevicePreview.tsx",
  "utf8",
);
const loader = readFileSync("apps/widget-v2/public/loader.js", "utf8");
const behavior = readFileSync(
  "src/components/widgets/builder/tabs/BehaviorTab.tsx",
  "utf8",
);

/** The `.ag-widget-teaser` rule in loader.js, which the preview has to match. */
const teaserRule = loader.slice(
  loader.indexOf(".ag-widget-teaser {"),
  loader.indexOf(".ag-widget-teaser.ag-is-visible"),
);
const dismissRule = loader.slice(
  loader.indexOf(".ag-widget-teaser-dismiss {"),
  loader.indexOf(".ag-widget-teaser-dismiss:hover"),
);

test("the builder preview renders the attention message at all", () => {
  // It is configurable on the Behavior tab but used to be invisible until it
  // reached a real visitor, so the only way to see the copy was to ship it.
  assert.match(behavior, /form\.proactiveMessage/);
  assert.match(preview, /proactiveMessage/);
  assert.match(preview, /\{proactiveMessage\}\s*<\/span>/);
});

test("it is shown only in the closed state, as the real teaser is", () => {
  // loader.js bails out of showTeaser when the panel is open. A preview that
  // drew the bubble over an open chat would show a state no visitor can reach.
  assert.match(loader, /function showTeaser[\s\S]*?teaserShown \|\| isOpen\) return;/);
  assert.match(preview, /isTeaserVisible =\s*!isOpen &&/);
});

test("empty or disabled means no bubble", () => {
  // loader.js: scheduleTeaser returns early unless the message has content.
  assert.match(loader, /if \(typeof message !== "string" \|\| !message\.trim\(\)\) return;/);
  assert.match(preview, /Boolean\(form\?\.proactiveEnabled\)/);
  assert.match(preview, /proactiveMessage\.length > 0/);
});

test("the preview box is the same box loader.js draws", () => {
  // Tailwind's scale is 0.25rem, so py-3 is 12px and px-3.5 is 14px; gap-2.5
  // is 10px. If either side moves, the preview stops predicting the launcher.
  const geometry: Array<[string, RegExp, RegExp]> = [
    ["offset above the launcher", /bottom: 68px;/, /bottom-\[68px\]/],
    ["right edge alignment", /right: 0;/, /right-0/],
    ["max width", /max-width: min\(288px,/, /max-w-\[288px\]/],
    ["shrink-to-fit width", /width: max-content;/, /\bw-max\b/],
    ["asymmetric corner", /border-radius: 16px 16px 4px 16px;/, /rounded-\[16px_16px_4px_16px\]/],
    ["padding", /padding: 12px 14px;/, /px-3\.5 py-3/],
    ["gap", /gap: 10px;/, /gap-2\.5/],
    ["type size", /font-size: 14px;/, /text-sm/],
    ["line height", /line-height: 1\.42;/, /leading-\[1\.42\]/],
    ["shadow", /box-shadow: 0 10px 32px rgba\(0, 0, 0, 0\.16\);/, /shadow-\[0_10px_32px_rgba\(0,0,0,0\.16\)\]/],
    ["top-aligned rows", /align-items: flex-start;/, /items-start/],
  ];

  for (const [what, inLoader, inPreview] of geometry) {
    assert.match(teaserRule, inLoader, `loader.js changed its ${what}`);
    assert.match(preview, inPreview, `the preview lost its ${what}`);
  }
});

test("the dismiss control keeps the same 20px hit area and offsets", () => {
  assert.match(dismissRule, /width: 20px;/);
  assert.match(dismissRule, /height: 20px;/);
  assert.match(dismissRule, /margin: -2px -4px 0 0;/);
  assert.match(dismissRule, /font-size: 15px;/);
  assert.match(dismissRule, /opacity: 0\.4;/);
  // -mt-0.5 is -2px and -mr-1 is -4px on the same 0.25rem scale.
  assert.match(preview, /-mr-1 -mt-0\.5 flex h-5 w-5/);
  assert.match(preview, /text-\[15px\]/);
  assert.match(preview, /opacity-40/);
});

test("dark and light follow loader.js exactly, including when dark applies", () => {
  // loader.js opts in to the dark bubble only for an explicitly dark widget,
  // so anything else — including an unset theme — takes the light one.
  assert.match(loader, /theme === "dark"[\s\S]{0,80}ag-is-dark/);
  assert.match(preview, /isTeaserDark = form\?\.theme === 'dark'/);

  const darkRule = loader.slice(
    loader.indexOf(".ag-widget-teaser.ag-is-dark"),
    loader.indexOf(".ag-widget-teaser-text"),
  );
  assert.match(darkRule, /background: #1c1d21;/);
  assert.match(darkRule, /color: #f4f4f5;/);
  assert.match(preview, /bg-\[#1c1d21\] text-\[#f4f4f5\]/);

  assert.match(teaserRule, /background: #ffffff;/);
  assert.match(teaserRule, /color: #17181a;/);
  assert.match(preview, /bg-white text-\[#17181a\]/);
});

test("long copy wraps instead of stretching the bubble", () => {
  // A single 200-character word is the case that blew the layout out.
  assert.match(loader, /overflow-wrap: anywhere;/);
  assert.match(preview, /\[overflow-wrap:anywhere\]/);
});

test("clicking the bubble opens the chat, and the cross only dismisses it", () => {
  // Opening is the outcome the teaser exists to produce; the cross must not
  // also open it, which is what a missing stopPropagation would do.
  assert.match(loader, /teaser\.onclick = openFromTeaser;/);
  assert.match(loader, /dismiss\.onclick = function \(event\) \{\s*event\.stopPropagation\(\);/);
  assert.match(preview, /onClick=\{\(\) => toggleWidgetOpen\(true\)\}/);
  assert.match(preview, /event\.stopPropagation\(\);\s*setDismissedTeaser\(proactiveMessage\)/);
});

test("the bubble is reachable and labelled without a mouse", () => {
  // loader.js gives it role=button, a tabindex and Enter/Space handling; a
  // preview that only responded to clicks would be a keyboard dead end.
  assert.match(preview, /role="button"/);
  assert.match(preview, /tabIndex=\{isTeaserVisible \? 0 : -1\}/);
  assert.match(preview, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(preview, /aria-label=\{proactiveMessage\}/);
  // Hidden means hidden: no focus stop left behind when the bubble is faded out.
  assert.match(preview, /aria-hidden=\{!isTeaserVisible\}/);
  assert.match(preview, /pointer-events-none translate-y-2\.5 scale-95 opacity-0/);
});

test("editing the copy brings a dismissed bubble back", () => {
  // Dismissal is permanent for a visitor but must not be permanent in the
  // builder, or one stray click costs you the preview for the rest of the session.
  assert.match(preview, /dismissedTeaser !== proactiveMessage/);
  assert.match(preview, /setDismissedTeaser\(null\)/);
});
