import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPPORTED_INTEGRATIONS } from "../../src/lib/integrations.ts";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

/** SimpleIcon and the locale files hold JSX / extensionless imports, so read them as source. */
const iconKeys = new Set(
  [...read("../../src/components/icons/SimpleIcon.tsx").matchAll(/^ {2}(si\w+):$/gm)].map(m => m[1]),
);

function storyCategories(locale: "en" | "sv") {
  const source = read(`../../src/locales/${locale}/landing-story.ts`);
  const block = source.match(/\n {4}"categories": \{([\s\S]*?)\n {4}\},/);
  assert.ok(block, `${locale} landing story has no integration categories`);
  return Object.fromEntries([...block[1].matchAll(/"([^"]+)": "([^"]+)"/g)].map(e => [e[1], e[2]]));
}

const marqueeApps = SUPPORTED_INTEGRATIONS.filter(app => app.simpleIcon);

test("the connected-app strip shows the real catalog, not a curated subset", () => {
  assert.equal(marqueeApps.length, SUPPORTED_INTEGRATIONS.length, "every supported integration needs a brand icon");
  assert.ok(marqueeApps.length >= 6, "the strip is only worth showing with a real catalog behind it");
});

test("every app in the strip has a brand mark that will actually render", () => {
  for (const app of marqueeApps) {
    assert.ok(iconKeys.has(app.simpleIcon!), `${app.displayName} has no path for ${app.simpleIcon}`);
  }
});

test("every category reaching the strip is translated in both languages", () => {
  const used = [...new Set(SUPPORTED_INTEGRATIONS.map(app => app.category))];
  for (const locale of ["en", "sv"] as const) {
    const categories = storyCategories(locale);
    for (const category of used) {
      assert.ok(categories[category]?.trim(), `${locale} is missing a label for "${category}"`);
    }
  }
  // Swedish must be a translation, not the English category echoed back.
  const sv = storyCategories("sv");
  assert.notEqual(sv.Communication, "Communication");
  assert.notEqual(sv.Marketing, "Marketing");
});
