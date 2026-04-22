/**
 * Stripe SDK singleton.
 *
 * Import `stripe` from this file wherever you need server-side Stripe operations.
 * Never import Stripe directly in route handlers — always go through this file.
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required environment variable: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
});

/**
 * Map plan tiers to Stripe Price IDs.
 * These are the recurring monthly prices created in Stripe.
 */
export const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1TP1pxEqNgWOqUOe64tSR342',  // $30/mo
  premium: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID || 'price_1TP1ptEqNgWOqUOePAREbCk0',  // $110/mo
};

/**
 * Map Stripe Price IDs back to plan tiers.
 * Used by the webhook to determine which plan to activate.
 */
export const STRIPE_PRICE_TO_PLAN: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1TP1pxEqNgWOqUOe64tSR342']: 'starter',
  [process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID || 'price_1TP1ptEqNgWOqUOePAREbCk0']: 'premium',
};

/**
 * Plan tier limits — mirrors the DB defaults.
 * Used by the webhook to update workspace_subscriptions correctly.
 */
export const PLAN_LIMITS: Record<string, { messages_limit: number; agents_limit: number; integrations_enabled: boolean }> = {
  free:    { messages_limit: 50,   agents_limit: 1,    integrations_enabled: false },
  starter: { messages_limit: 500,  agents_limit: 3,    integrations_enabled: true  },
  premium: { messages_limit: 4000, agents_limit: 9999, integrations_enabled: true  },
};
