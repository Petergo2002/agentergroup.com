import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasPremiumCapabilities,
  PLAN_LIMITS,
} from "../../src/lib/plan-limits.ts";

const crawlRoute = readFileSync("src/app/api/knowledge/sources/route.ts", "utf8");
const mapRoute = readFileSync(
  "src/app/api/knowledge/sources/map/route.ts",
  "utf8",
);
const knowledgeUi = readFileSync(
  "src/app/(app)/knowledge/KnowledgePageClient.tsx",
  "utf8",
);
const brandingLoader = readFileSync("src/lib/widgets/loader.ts", "utf8");

test("trial unlocks the premium capability set", () => {
  assert.equal(hasPremiumCapabilities("trial"), true);
  assert.equal(hasPremiumCapabilities("premium"), true);
  assert.equal(hasPremiumCapabilities("starter"), false);
  assert.equal(hasPremiumCapabilities("free"), false);
  assert.equal(hasPremiumCapabilities(null), false);
  assert.equal(hasPremiumCapabilities(undefined), false);
});

test("capabilities are unlocked without handing over premium volume", () => {
  // The point of the trial is to show what the product does, not to become a
  // way to get Premium allowances for nothing.
  assert.equal(PLAN_LIMITS.trial.messages_limit, 500);
  assert.ok(
    PLAN_LIMITS.trial.messages_limit < PLAN_LIMITS.premium.messages_limit,
  );
  assert.ok(PLAN_LIMITS.trial.agents_limit < PLAN_LIMITS.premium.agents_limit);
  assert.ok(
    PLAN_LIMITS.trial.storage_limit_bytes <=
      PLAN_LIMITS.premium.storage_limit_bytes,
  );
});

test("multi-page crawling is gated on the capability, not the premium tier", () => {
  assert.match(crawlRoute, /hasPremiumCapabilities\(/);
  assert.doesNotMatch(crawlRoute, /plan_tier === "premium"/);
  assert.match(crawlRoute, /const crawlLimit = canCrawlWholeSite \? requestedLimit : 1;/);
});

test("sitemap discovery uses the same gate as the crawl it feeds", () => {
  // Unlocking the crawl alone leaves "Find pages" returning 403, so the two
  // must not be allowed to drift apart.
  assert.match(mapRoute, /hasPremiumCapabilities\(/);
  assert.doesNotMatch(mapRoute, /plan_tier !== "premium"/);
});

test("the knowledge UI hint matches what the API actually allows", () => {
  assert.match(knowledgeUi, /!hasPremiumCapabilities\(subscription\?\.plan_tier\)/);
});

test("widget branding removal is deliberately NOT part of the trial", () => {
  // Kept premium-only on purpose: a trial that strips Avenro branding from a
  // live customer site gives away attribution exactly when the product is most
  // visible, and puts the badge back on their site the day the trial ends.
  // Changing this should be a decision, not a drive-by edit.
  assert.match(brandingLoader, /planTier === "premium"/);
  assert.doesNotMatch(brandingLoader, /hasPremiumCapabilities/);
});

test("the edge function applies the same rule as the route it trusts least", () => {
  // The route's decision reaches the processor as source metadata, which the
  // processor is right not to trust — so it re-checks the plan itself. That
  // check is what actually holds, and leaving it on "premium" would have let a
  // trial pass the route and then fail during processing, which is worse than
  // being capped at one page.
  const edgeFunction = readFileSync(
    "supabase/functions/process-knowledge-source/index.ts",
    "utf8",
  );

  assert.match(
    edgeFunction,
    /planTier === "premium" \|\| planTier === "trial"/,
  );
  assert.doesNotMatch(edgeFunction, /const isPremium =/);
  // Every branch must use the capability, not a leftover tier comparison.
  assert.doesNotMatch(edgeFunction, /&& isPremium\b/);
});
