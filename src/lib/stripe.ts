/**
 * Stripe SDK and billing configuration helpers.
 *
 * Keep this module import-safe: billing routes should fail when invoked with
 * missing billing env, not during unrelated module evaluation.
 */

import Stripe from "stripe";
import { PLAN_LIMITS } from "./plan-limits";
import type { PlanTier } from "./types/subscription";

export class BillingConfigurationError extends Error {
  status = 503;

  constructor(message = "Billing is not configured.") {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

const STRIPE_BILLING_PLANS = ["starter", "premium"] as const;
type StripeBillingPlan = (typeof STRIPE_BILLING_PLANS)[number];

let stripeClient: Stripe | null = null;
let stripeClientSecret: string | null = null;

function requireBillingEnv(value: string | undefined, name: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new BillingConfigurationError(
      `Missing required billing environment variable: ${name}`,
    );
  }

  return normalized;
}

export function isStripeBillingPlan(plan: string): plan is StripeBillingPlan {
  return STRIPE_BILLING_PLANS.includes(plan as StripeBillingPlan);
}

export function getStripe() {
  const secretKey = requireBillingEnv(
    process.env.STRIPE_SECRET_KEY,
    "STRIPE_SECRET_KEY",
  );

  if (!stripeClient || stripeClientSecret !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
    stripeClientSecret = secretKey;
  }

  return stripeClient;
}

export function getStripePriceIds(): Record<StripeBillingPlan, string> {
  return {
    starter: requireBillingEnv(
      process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
      "NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID",
    ),
    premium: requireBillingEnv(
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID,
      "NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID",
    ),
  };
}

export function getStripePriceToPlan(): Record<string, PlanTier> {
  const priceIds = getStripePriceIds();

  return {
    [priceIds.starter]: "starter",
    [priceIds.premium]: "premium",
  };
}

export function getStripeExtraCredits500PriceId() {
  return requireBillingEnv(
    process.env.STRIPE_EXTRA_CREDITS_500_PRICE_ID,
    "STRIPE_EXTRA_CREDITS_500_PRICE_ID",
  );
}

export { PLAN_LIMITS };
