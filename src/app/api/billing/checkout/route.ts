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
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe';

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

    if (!plan || !STRIPE_PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan. Must be "starter" or "premium".' }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    // Verify RBAC: only owner/admin can manage billing
    const { data: memberData, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData || !['owner', 'admin'].includes(memberData.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only workspace admins can manage billing.' }, { status: 403 });
    }

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
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
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
    console.error('[billing/checkout] Error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
