import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("managed pilot billing stays default-off and centrally controlled", () => {
  const source = readFileSync("src/lib/billing-mode.ts", "utf8");

  assert.match(source, /NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED === 'true'/);
  assert.match(source, /MANUAL_PLAN_ACTIVATION_ENABLED = !SELF_SERVE_BILLING_ENABLED/);
});

test("customer billing routes reject requests while self-serve billing is disabled", () => {
  const routes = [
    "src/app/api/billing/checkout/route.ts",
    "src/app/api/billing/extra-credits/checkout/route.ts",
    "src/app/api/billing/invoices/route.ts",
    "src/app/api/billing/portal/route.ts",
  ];

  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /if \(!SELF_SERVE_BILLING_ENABLED\)/, route);
    assert.match(source, /status: 404/, route);
  }
});

test("onboarding waits for admin activation instead of starting checkout", () => {
  const source = readFileSync(
    "src/app/onboarding/OnboardingContent.tsx",
    "utf8",
  );

  assert.match(source, /Approval pending/);
  assert.match(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /api\/billing\/checkout|PLAN_PRICES|Powered by Stripe/);
});

test("admin plan assignment stores limits before unlocking workspace access", () => {
  const source = readFileSync(
    "src/app/api/admin/workspaces/[id]/plan/route.ts",
    "utf8",
  );
  const subscriptionUpdate = source.indexOf('.from("workspace_subscriptions")');
  const workspaceActivation = source.indexOf('.from("workspaces")');

  assert.ok(subscriptionUpdate >= 0);
  assert.ok(workspaceActivation > subscriptionUpdate);
  assert.match(source, /onboarding_completed: true/);
});
