/**
 * POST /api/billing/webhook
 *
 * Receives Stripe webhook events and updates the database accordingly.
 * This is the ONLY place the database subscription state is updated from Stripe.
 *
 * Events handled:
 * - checkout.session.completed      → activate new plan after payment
 * - customer.subscription.updated   → handle plan changes / renewals
 * - customer.subscription.deleted   → downgrade to free plan
 * - invoice.payment_failed          → log the failure (extendable to email alerts)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { stripe, STRIPE_PRICE_TO_PLAN, PLAN_LIMITS } from '@/lib/stripe';


/**
 * Creates a privileged Supabase client using the service role key.
 * Required because the webhook runs outside of user sessions.
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Updates the workspace subscription in the database with the new plan state.
 * Called by every Stripe event that changes subscription status.
 */
async function updateWorkspaceSubscription(
  workspaceId: string,
  planTier: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
) {
  const admin = createAdminClient();
  const limits = PLAN_LIMITS[planTier] ?? PLAN_LIMITS['free'];

  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  const { error } = await admin
    .from('workspace_subscriptions')
    .update({
      plan_tier: planTier,
      messages_limit: limits.messages_limit,
      agents_limit: limits.agents_limit,
      integrations_enabled: limits.integrations_enabled,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: cycleEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[webhook] Failed to update workspace subscription:', error);
    throw error;
  }

  console.log(`[webhook] Updated workspace ${workspaceId} → plan: ${planTier}`);
}

/**
 * Downgrades a workspace to the free plan when a subscription is cancelled.
 */
async function downgradeToFree(workspaceId: string) {
  const admin = createAdminClient();
  const limits = PLAN_LIMITS['free'];

  const { error } = await admin
    .from('workspace_subscriptions')
    .update({
      plan_tier: 'free',
      messages_limit: limits.messages_limit,
      agents_limit: limits.agents_limit,
      integrations_enabled: limits.integrations_enabled,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[webhook] Failed to downgrade workspace:', error);
    throw error;
  }

  console.log(`[webhook] Downgraded workspace ${workspaceId} → free plan`);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Verify the event came from Stripe (prevents spoofed events)
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Process the verified event
  try {
    switch (event.type) {

      // ─── Checkout completed — user just paid for the first time ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== 'subscription') break;

        // Retrieve the full subscription to get the price ID and metadata
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const workspaceId = subscription.metadata?.workspace_id;

        if (!workspaceId) {
          console.error('[webhook] checkout.session.completed: missing workspace_id in subscription metadata');
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const planTier = STRIPE_PRICE_TO_PLAN[priceId] ?? 'free';

        await updateWorkspaceSubscription(
          workspaceId,
          planTier,
          session.customer as string,
          session.subscription as string,
        );
        break;
      }

      // ─── Subscription updated — plan change or renewal ───────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const workspaceId = subscription.metadata?.workspace_id;

        if (!workspaceId) {
          console.warn('[webhook] customer.subscription.updated: missing workspace_id, skipping');
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const planTier = STRIPE_PRICE_TO_PLAN[priceId] ?? 'free';

        if (subscription.status === 'active') {
          await updateWorkspaceSubscription(
            workspaceId,
            planTier,
            subscription.customer as string,
            subscription.id,
          );
        }
        break;
      }

      // ─── Subscription deleted — user cancelled ────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const workspaceId = subscription.metadata?.workspace_id;

        if (!workspaceId) {
          console.warn('[webhook] customer.subscription.deleted: missing workspace_id, skipping');
          break;
        }

        await downgradeToFree(workspaceId);
        break;
      }

      // ─── Payment failed — log it (extend to send email notifications later) ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[webhook] Payment failed for customer:', invoice.customer, '| Invoice:', invoice.id);
        // TODO: send email notification via Resend
        break;
      }

      default:
        // Unhandled event types are OK — Stripe sends many event types
        break;
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error('[webhook] Error processing event:', event.type, err);
    // Return 500 so Stripe will retry the webhook
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
