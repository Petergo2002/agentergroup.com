/**
 * Customer self-serve billing is disabled during the managed pilot.
 *
 * Set NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED=true to restore the customer
 * billing page, upgrade prompts, and Stripe checkout endpoints.
 */
export const SELF_SERVE_BILLING_ENABLED =
  process.env.NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED === 'true';

export const MANUAL_PLAN_ACTIVATION_ENABLED = !SELF_SERVE_BILLING_ENABLED;
