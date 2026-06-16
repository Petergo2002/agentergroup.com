import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getStripeSubscriptionPeriod,
  isStripeSubscriptionEntitled,
  resolveStripePlan,
  shouldReclaimStripeWebhookEvent,
  UnknownStripePriceError,
} from "../../src/lib/stripe-webhook.ts";

const webhookRoute = readFileSync(
  "src/app/api/billing/webhook/route.ts",
  "utf8",
);
const billingCustomer = readFileSync("src/lib/billing-customer.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260611203154_stripe_webhook_reliability.sql",
  "utf8",
);

test("Stripe webhook replay decisions reject completed and active claims", () => {
  const now = 1_000_000;
  const staleAfter = 300_000;

  assert.equal(
    shouldReclaimStripeWebhookEvent(
      { processingStatus: "processed", updatedAtMs: 0 },
      now,
      staleAfter,
    ),
    false,
  );
  assert.equal(
    shouldReclaimStripeWebhookEvent(
      { processingStatus: "processing", updatedAtMs: now - 1_000 },
      now,
      staleAfter,
    ),
    false,
  );
  assert.equal(
    shouldReclaimStripeWebhookEvent(
      { processingStatus: "processing", updatedAtMs: now - staleAfter },
      now,
      staleAfter,
    ),
    true,
  );
  assert.equal(
    shouldReclaimStripeWebhookEvent(
      { processingStatus: "failed", updatedAtMs: now },
      now,
      staleAfter,
    ),
    true,
  );
});

test("unknown Stripe prices require review instead of mapping to Free", () => {
  assert.equal(
    resolveStripePlan("price_starter", { price_starter: "starter" }),
    "starter",
  );
  assert.throws(
    () => resolveStripePlan("price_unknown", { price_starter: "starter" }),
    UnknownStripePriceError,
  );
});

test("Stripe status and billing periods use subscription state", () => {
  for (const status of ["trialing", "active", "past_due"] as const) {
    assert.equal(isStripeSubscriptionEntitled(status), true);
  }
  for (const status of [
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const) {
    assert.equal(isStripeSubscriptionEntitled(status), false);
  }

  assert.deepEqual(
    getStripeSubscriptionPeriod({
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_700_086_400,
          },
        ],
      },
    } as never),
    {
      start: "2023-11-14T22:13:20.000Z",
      end: "2023-11-15T22:13:20.000Z",
    },
  );
});

test("billing persistence is idempotent and ordered in storage", () => {
  assert.match(billingCustomer, /idempotencyKey: `workspace:\$\{input\.workspaceId\}:stripe-customer`/);
  assert.match(billingCustomer, /\.is\("stripe_customer_id", null\)/);
  assert.match(webhookRoute, /stripe_webhook_events/);
  assert.match(webhookRoute, /requires_review/);
  assert.match(migration, /event_id text primary key/);
  assert.match(
    migration,
    /stripe_last_event_created_at <= p_event_created_at/,
  );
});
