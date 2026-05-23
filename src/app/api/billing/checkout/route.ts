/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for plan upgrades.
 * Returns a checkout URL that the frontend redirects the user to.
 *
 * Body: { plan: 'starter' | 'premium' }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/lib/env';
import {
  BillingConfigurationError,
  getStripe,
  getStripePriceIds,
  isStripeBillingPlan,
} from '@/lib/stripe';
import {
  BillingAuthorizationError,
  assertWorkspaceBillingAdmin,
  type BillingAuthorizationClient,
} from '@/lib/billing-authorization';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the requested plan
    const body = await req.json();
    const { plan, workspaceId } = body as { plan: string; workspaceId: string };

    if (!plan || !isStripeBillingPlan(plan)) {
      return NextResponse.json({ error: 'Invalid plan. Must be "starter" or "premium".' }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    await assertWorkspaceBillingAdmin(
      supabase as unknown as BillingAuthorizationClient,
      workspaceId,
      user.id,
    );

    // Fetch the workspace subscription row so we can look up or create a Stripe customer
    const { data: subscription, error: subError } = await supabase
      .from('workspace_subscriptions')
      .select('stripe_customer_id, plan_tier')
      .eq('workspace_id', workspaceId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Workspace subscription not found' }, { status: 404 });
    }

    // If they are already on this plan, short-circuit
    if (subscription.plan_tier === plan) {
      return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 });
    }

    const stripe = getStripe();
    const stripePriceIds = getStripePriceIds();

    // Find or create a Stripe Customer for this workspace
    let stripeCustomerId = subscription.stripe_customer_id;

    if (!stripeCustomerId) {
      // Fetch the user's profile to get their email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { workspace_id: workspaceId, user_id: user.id },
      });

      stripeCustomerId = customer.id;

      // Store the customer ID immediately so future requests reuse it
      await supabase
        .from('workspace_subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('workspace_id', workspaceId);
    }

    const appUrl = getAppUrl();

    const successUrl = `${appUrl}/onboarding?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/onboarding?canceled=true`;

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceIds[plan], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Pass workspace context through metadata so the webhook knows which workspace to update
      subscription_data: {
        metadata: { workspace_id: workspaceId },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });

  } catch (err) {
    if (err instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof BillingConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error('[billing/checkout] Error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
