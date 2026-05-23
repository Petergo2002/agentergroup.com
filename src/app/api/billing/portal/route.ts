/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session.
 * Lets the user manage their subscription, update their card, and view invoices
 * on Stripe's hosted portal — without us building any of that UI.
 *
 * Body: { workspaceId: string }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/lib/env';
import { BillingConfigurationError, getStripe } from '@/lib/stripe';
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

    const body = await req.json();
    const { workspaceId } = body as { workspaceId: string };

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    await assertWorkspaceBillingAdmin(
      supabase as unknown as BillingAuthorizationClient,
      workspaceId,
      user.id,
    );

    // Get the Stripe customer ID for this workspace
    const { data: subscription, error: subError } = await supabase
      .from('workspace_subscriptions')
      .select('stripe_customer_id, plan_tier')
      .eq('workspace_id', workspaceId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Workspace subscription not found' }, { status: 404 });
    }

    if (!subscription.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active paid subscription. Upgrade a plan first.' },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl();
    const stripe = getStripe();

    // Create the Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (err) {
    if (err instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof BillingConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error('[billing/portal] Error:', err);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
