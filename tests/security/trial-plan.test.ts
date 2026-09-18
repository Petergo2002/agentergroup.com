import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PLAN_LIMITS,
  TRIAL_DURATION_DAYS,
  getTeamMemberLimitForPlan,
} from "../../src/lib/plan-limits.ts";

const migration = readFileSync(
  "supabase/migrations/20260918140000_thirty_day_trial_plan.sql",
  "utf8",
);
const planRoute = readFileSync(
  "src/app/api/admin/workspaces/[id]/plan/route.ts",
  "utf8",
);

test("a trial grants 500 messages for 30 days", () => {
  assert.equal(PLAN_LIMITS.trial.messages_limit, 500);
  assert.equal(TRIAL_DURATION_DAYS, 30);
});

test("a trial can actually use the product it is trialling", () => {
  // A trial without integrations is not a trial of the thing anyone buys.
  assert.equal(PLAN_LIMITS.trial.integrations_enabled, true);
  assert.ok(PLAN_LIMITS.trial.agents_limit > PLAN_LIMITS.free.agents_limit);
  assert.equal(getTeamMemberLimitForPlan("trial"), 2);
});

test("the expiry check runs before the billing-cycle reset", () => {
  // A trial's billing_cycle_end lands on the day it expires. If the reset ran
  // first it would zero the counter and push the cycle out a month, handing
  // out a fresh 500 messages forever — the opposite of an expiring trial.
  const trialBranch = migration.indexOf("IF v_sub.plan_tier = 'trial' THEN");
  const resetBranch = migration.indexOf("Reset cycle if expired");

  assert.ok(trialBranch > 0, "expected a trial branch");
  assert.ok(resetBranch > 0, "expected the cycle reset to still exist");
  assert.ok(
    trialBranch < resetBranch,
    "the trial branch must come before the cycle reset",
  );
});

test("an expired trial is denied, and a trial with no end date fails closed", () => {
  assert.match(
    migration,
    /v_sub\.trial_ends_at IS NULL OR v_sub\.trial_ends_at <= now\(\)/,
  );
  // Both conditions return false rather than falling through to the reset.
  const branch = migration.slice(
    migration.indexOf("IF v_sub.plan_tier = 'trial' THEN"),
    migration.indexOf("Reset cycle if expired"),
  );
  assert.match(branch, /RETURN false;/);
});

test("trial is an allowed plan tier in the database", () => {
  assert.match(migration, /'trial'::text/);
  assert.match(migration, /add column if not exists trial_ends_at timestamptz/);
});

test("granting a trial sets a deadline and starts the allowance at zero", () => {
  assert.match(planRoute, /messages_used: 0/);
  assert.match(planRoute, /trial_ends_at: addDays\(now, TRIAL_DURATION_DAYS\)/);
});

test("moving to any other plan clears the trial deadline", () => {
  // Otherwise a workspace upgraded mid-trial keeps a stale deadline on record.
  assert.match(planRoute, /:\s*\{\s*trial_ends_at:\s*null\s*\}/);
});

test("the admin endpoint accepts trial as a plan tier", () => {
  assert.match(
    planRoute,
    /VALID_PLANS = new Set<PlanTier>\(\["free", "starter", "premium", "trial"\]\)/,
  );
});
