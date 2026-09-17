import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability/report";
import Stripe from "stripe";
import {
  EXTRA_MESSAGE_CREDIT_PACK_AMOUNT,
  EXTRA_MESSAGE_CREDIT_PURCHASE_TYPE,
} from "@/lib/billing-credits";
import {
  BillingConfigurationError,
  getStripe,
  getStripePriceToPlan,
  PLAN_LIMITS,
} from "@/lib/stripe";
import {
  getStripeCustomerId,
  getStripeSubscriptionPeriod,
  isStripeSubscriptionEntitled,
  resolveStripePlan,
  shouldReclaimStripeWebhookEvent,
  UnknownStripePriceError,
} from "@/lib/stripe-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/types/subscription";

interface PurchasedCreditsRpcRow {
  workspace_id: string;
  messages_limit: number;
  messages_used: number;
  granted_amount: number;
  already_granted: boolean;
}

interface StripeWebhookEventRow {
  processing_status:
    | "processing"
    | "processed"
    | "failed"
    | "requires_review";
  updated_at: string;
}

const PROCESSING_STALE_MS = 5 * 60 * 1000;

async function claimWebhookEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      event_created_at: event.created,
      processing_status: "processing",
      updated_at: now,
    });

  if (!insertError) {
    return true;
  }

  if (insertError.code !== "23505") {
    throw new Error(`Failed to claim Stripe event: ${insertError.message}`);
  }

  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("processing_status, updated_at")
    .eq("event_id", event.id)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to load existing Stripe event state.",
    );
  }

  const existing = data as StripeWebhookEventRow;
  if (
    !shouldReclaimStripeWebhookEvent(
      {
        processingStatus: existing.processing_status,
        updatedAtMs: new Date(existing.updated_at).getTime(),
      },
      Date.now(),
      PROCESSING_STALE_MS,
    )
  ) {
    return false;
  }

  const { error: reclaimError } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      error_message: null,
      processed_at: null,
      updated_at: now,
    })
    .eq("event_id", event.id);

  if (reclaimError) {
    throw new Error(`Failed to reclaim Stripe event: ${reclaimError.message}`);
  }

  return true;
}

async function updateWebhookEvent(
  eventId: string,
  status: "processed" | "failed" | "requires_review",
  errorMessage?: string | null,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
      processed_at: status === "failed" ? null : now,
      updated_at: now,
    })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`Failed to update Stripe event ledger: ${error.message}`);
  }
}

async function grantPurchasedMessageCredits(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const workspaceId = metadata.workspace_id;
  const actorUserId = metadata.actor_user_id;
  const amount = metadata.amount;
  const metadataSessionId = metadata.stripe_session_id;

  if (
    !workspaceId ||
    !actorUserId ||
    amount !== String(EXTRA_MESSAGE_CREDIT_PACK_AMOUNT) ||
    metadataSessionId !== session.id
  ) {
    throw new Error(
      `[webhook] extra credits checkout session ${session.id} has invalid metadata`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_workspace_purchased_messages", {
    p_workspace_id: workspaceId,
    p_actor_id: actorUserId,
    p_stripe_session_id: session.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  const grant = Array.isArray(data)
    ? (data[0] as PurchasedCreditsRpcRow | undefined)
    : undefined;

  if (!grant) {
    throw new Error(
      `[webhook] extra credits checkout session ${session.id} did not return a grant row`,
    );
  }
}

async function applySubscriptionState(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  workspaceIdOverride?: string | null,
) {
  const workspaceId =
    subscription.metadata?.workspace_id ?? workspaceIdOverride ?? null;

  if (!workspaceId) {
    throw new Error(
      `${event.type} is missing workspace_id in Stripe metadata.`,
    );
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const paidPlan = resolveStripePlan(priceId, getStripePriceToPlan());
  const effectivePlan: PlanTier = isStripeSubscriptionEntitled(
    subscription.status,
  )
    ? paidPlan
    : "free";
  const limits = PLAN_LIMITS[effectivePlan];
  const period = getStripeSubscriptionPeriod(subscription);
  const customerId = getStripeCustomerId(subscription.customer);
  const admin = createAdminClient();
  const { data: applied, error } = await admin.rpc(
    "apply_workspace_subscription_event",
    {
      p_workspace_id: workspaceId,
      p_plan_tier: effectivePlan,
      p_messages_limit: limits.messages_limit,
      p_agents_limit: limits.agents_limit,
      p_integrations_enabled: limits.integrations_enabled,
      p_storage_limit_bytes: limits.storage_limit_bytes,
      p_subscription_status: subscription.status,
      p_customer_id: customerId,
      p_subscription_id: subscription.id,
      p_price_id: priceId,
      p_period_start: period.start,
      p_period_end: period.end,
      p_event_created_at: event.created,
      p_event_id: event.id,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (applied && isStripeSubscriptionEntitled(subscription.status)) {
    const { error: workspaceError } = await admin
      .from("workspaces")
      .update({ onboarding_completed: true })
      .eq("id", workspaceId);

    if (workspaceError) {
      throw new Error(workspaceError.message);
    }
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  let stripe: ReturnType<typeof getStripe>;

  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: error.status },
      );
    }

    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const claimed = await claimWebhookEvent(event);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (
          session.mode === "payment" &&
          session.metadata?.purchase_type ===
            EXTRA_MESSAGE_CREDIT_PURCHASE_TYPE
        ) {
          await grantPurchasedMessageCredits(session);
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) {
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        await applySubscriptionState(
          event,
          subscription,
          session.metadata?.workspace_id,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const eventSubscription =
          event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(
          eventSubscription.id,
        );
        await applySubscriptionState(event, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await applySubscriptionState(event, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("[billing/webhook] Invoice payment failed", {
          invoiceId: invoice.id,
          customerId:
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id ?? null,
        });
        break;
      }

      default:
        break;
    }

    await updateWebhookEvent(event.id, "processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof UnknownStripePriceError) {
      console.error("[billing/webhook] Stripe price requires manual review", {
        eventId: event.id,
        eventType: event.type,
        priceId: error.priceId,
      });

      try {
        await updateWebhookEvent(
          event.id,
          "requires_review",
          error.message,
        );
      } catch (ledgerError) {
        console.error(
          "[billing/webhook] Failed to record manual review state",
          ledgerError,
        );
        return NextResponse.json(
          { error: "Webhook processing failed" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        received: true,
        requiresReview: true,
      });
    }

    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    reportError(error, {
      operation: "billing.webhook",
      route: "/api/billing/webhook",
      stripeEventId: event.id,
      stripeEventType: event.type,
    });

    try {
      await updateWebhookEvent(event.id, "failed", message);
    } catch (ledgerError) {
      // Losing the ledger write can let a failed event be replayed silently.
      reportError(ledgerError, {
        operation: "billing.webhook_ledger",
        route: "/api/billing/webhook",
        stripeEventId: event.id,
        stripeEventType: event.type,
      }, "fatal");
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
