/**
 * GET /api/billing/invoices
 *
 * Fetches the last 10 invoices for the current workspace from Stripe.
 * Falls back to an empty array if the workspace has no Stripe customer yet.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingConfigurationError, getStripe } from '@/lib/stripe';
import {
  BillingAuthorizationError,
  assertWorkspaceBillingAdmin,
  type BillingAuthorizationClient,
} from '@/lib/billing-authorization';
import { SELF_SERVE_BILLING_ENABLED } from '@/lib/billing-mode';

export async function GET(req: Request) {
  if (!SELF_SERVE_BILLING_ENABLED) {
    return NextResponse.json(
      { error: 'Self-serve billing is not available.' },
      { status: 404 },
    );
  }

  try {
    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspaceId from query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    await assertWorkspaceBillingAdmin(
      supabase as unknown as BillingAuthorizationClient,
      workspaceId,
      user.id,
    );

    // Get the Stripe customer ID for this workspace
    const { data: subscription } = await supabase
      .from('workspace_subscriptions')
      .select('stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .single();

    // No Stripe customer yet — return empty invoices (free plan)
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = getStripe();

    // Fetch the last 10 invoices from Stripe
    const invoicesResponse = await stripe.invoices.list({
      customer: subscription.stripe_customer_id,
      limit: 10,
    });

    // Shape the invoice data for the frontend
    const invoices = invoicesResponse.data.map((inv) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      amount: `$${((inv.amount_paid ?? 0) / 100).toFixed(2)}`,
      status: inv.status === 'paid' ? 'Paid' : inv.status === 'open' ? 'Open' : 'Void',
      pdf: inv.invoice_pdf ?? null,
    }));

    return NextResponse.json({ invoices });

  } catch (err) {
    if (err instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof BillingConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error('[billing/invoices] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
