import { NextResponse } from "next/server";
import { assertWorkspaceBillingAdmin, BillingAuthorizationError, type BillingAuthorizationClient } from "@/lib/billing-authorization";
import {
  EXTRA_MESSAGE_CREDIT_PACK_AMOUNT,
  EXTRA_MESSAGE_CREDIT_PURCHASE_TYPE,
} from "@/lib/billing-credits";
import { getAppUrl } from "@/lib/env";
import {
  BillingConfigurationError,
  getStripe,
  getStripeExtraCredits500PriceId,
} from "@/lib/stripe";
import { getOrCreateWorkspaceStripeCustomer } from "@/lib/billing-customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SELF_SERVE_BILLING_ENABLED } from "@/lib/billing-mode";

export async function POST(req: Request) {
  if (!SELF_SERVE_BILLING_ENABLED) {
    return NextResponse.json(
      { error: "Self-serve billing is not available." },
      { status: 404 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    await assertWorkspaceBillingAdmin(
      supabase as unknown as BillingAuthorizationClient,
      workspaceId,
      user.id,
    );

    const admin = createAdminClient();
    const { data: subscription, error: subscriptionError } = await admin
      .from("workspace_subscriptions")
      .select("stripe_customer_id, plan_tier")
      .eq("workspace_id", workspaceId)
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        { error: "Workspace subscription not found" },
        { status: 404 },
      );
    }

    if (subscription.plan_tier === "free") {
      return NextResponse.json(
        { error: "Extra credits are available on Starter and Premium plans." },
        { status: 403 },
      );
    }

    const stripe = getStripe();
    const extraCreditsPriceId = getStripeExtraCredits500PriceId();
    const stripeCustomerId = await getOrCreateWorkspaceStripeCustomer({
      stripe,
      workspaceId,
      user,
      existingCustomerId: subscription.stripe_customer_id,
    });

    const appUrl = getAppUrl();
    const metadata = {
      purchase_type: EXTRA_MESSAGE_CREDIT_PURCHASE_TYPE,
      workspace_id: workspaceId,
      actor_user_id: user.id,
      amount: String(EXTRA_MESSAGE_CREDIT_PACK_AMOUNT),
    };

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment",
      line_items: [
        {
          price: extraCreditsPriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings/billing?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/billing?credits=canceled`,
      submit_type: "pay",
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    await stripe.checkout.sessions.update(session.id, {
      metadata: {
        ...metadata,
        stripe_session_id: session.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof BillingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[billing/extra-credits/checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create extra credits checkout session" },
      { status: 500 },
    );
  }
}
