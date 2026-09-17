import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Messages } from "../../src/locales/en.ts";
import { demoContactHref, marketingNavItems } from "../../src/components/marketing/marketing-links.ts";

type NavCopy = Messages["landing"]["nav"];

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

/** The locale modules use extensionless imports, so read them as source instead. */
function navKeys(locale: "en" | "sv") {
  const source = read(`../../src/locales/${locale}/landing.ts`);
  const block = source.match(/\n {2}nav: \{([\s\S]*?)\n {2}\},/);
  assert.ok(block, `${locale} landing copy has no nav block`);
  return Object.fromEntries(
    [...block[1].matchAll(/^\s{4}(\w+): "([^"]*)",$/gm)].map(entry => [entry[1], entry[2]]),
  );
}

const landingSource = read("../../src/components/marketing/LandingPage.tsx");
const sectionIds = [...landingSource.matchAll(/<section id="([^"]+)"/g)].map(match => match[1]);

test("the header, mobile menu and footer share one navigation list", () => {
  // A recording stub reports which copy keys the shared list actually reads.
  const used: string[] = [];
  const probe = new Proxy({}, { get: (_target, key: string) => { used.push(key); return key; } }) as NavCopy;
  const items = marketingNavItems(probe);

  assert.deepEqual(items.map(item => item.id), ["how-it-works", "integrations", "workspace", "security", "faq"]);
  assert.deepEqual(used, ["howItWorks", "tools", "workspace", "security", "faq"]);
});

test("every navigation item points at a section that exists, in page order", () => {
  const ids = marketingNavItems({} as NavCopy).map(item => item.id);
  for (const id of ids) assert.ok(sectionIds.includes(id), `#${id} has no matching section`);

  const positions = ids.map(id => sectionIds.indexOf(id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "navigation must follow page order");
});

test("both languages label every navigation item, with distinct translations", () => {
  const labelKeys = ["howItWorks", "tools", "workspace", "security", "faq"];
  const en = navKeys("en");
  const sv = navKeys("sv");

  for (const key of labelKeys) {
    assert.ok(en[key]?.trim(), `English nav is missing ${key}`);
    assert.ok(sv[key]?.trim(), `Swedish nav is missing ${key}`);
  }
  assert.notDeepEqual(
    labelKeys.map(key => sv[key]),
    labelKeys.map(key => en[key]),
  );
});

test("the demo CTA stays a prefilled mail to Avenro in both languages", () => {
  for (const language of ["sv", "en"] as const) {
    const href = demoContactHref(language);
    assert.ok(href.startsWith("mailto:info@avenro.se?"), href);
    assert.ok(href.includes("subject="), "the demo mail must arrive prefilled");
    assert.ok(href.includes("body="), "the demo mail must arrive prefilled");
  }
});
