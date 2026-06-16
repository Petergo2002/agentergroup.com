import type Stripe from "stripe";
import type { PlanTier } from "@/lib/types/subscription";

export class UnknownStripePriceError extends Error {
  readonly priceId: string | null;

  constructor(priceId: string | null) {
    super(
      priceId
        ? `Unknown Stripe price id: ${priceId}`
        : "Stripe subscription has no price id.",
    );
    this.name = "UnknownStripePriceError";
    this.priceId = priceId;
  }
}

export type StripeWebhookProcessingStatus =
  | "processing"
  | "processed"
  | "failed"
  | "requires_review";

export function shouldReclaimStripeWebhookEvent(
  existing: {
    processingStatus: StripeWebhookProcessingStatus;
    updatedAtMs: number;
  },
  nowMs: number,
  staleAfterMs: number,
) {
  if (
    existing.processingStatus === "processed" ||
    existing.processingStatus === "requires_review"
  ) {
    return false;
  }

  return (
    existing.processingStatus === "failed" ||
    nowMs - existing.updatedAtMs >= staleAfterMs
  );
}

export function resolveStripePlan(
  priceId: string | null | undefined,
  priceToPlan: Record<string, PlanTier>,
) {
  if (!priceId || !Object.hasOwn(priceToPlan, priceId)) {
    throw new UnknownStripePriceError(priceId ?? null);
  }

  return priceToPlan[priceId];
}

export function isStripeSubscriptionEntitled(
  status: Stripe.Subscription.Status,
) {
  return ["trialing", "active", "past_due"].includes(status);
}

export function getStripeSubscriptionPeriod(
  subscription: Stripe.Subscription,
) {
  const item = subscription.items.data[0];

  if (
    !item ||
    !Number.isFinite(item.current_period_start) ||
    !Number.isFinite(item.current_period_end)
  ) {
    throw new Error("Stripe subscription is missing its billing period.");
  }

  return {
    start: new Date(item.current_period_start * 1000).toISOString(),
    end: new Date(item.current_period_end * 1000).toISOString(),
  };
}

export function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
) {
  return typeof customer === "string" ? customer : customer.id;
}
