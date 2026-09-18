export type PlanTier = 'free' | 'starter' | 'premium' | 'trial';
export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface WorkspaceSubscriptionRecord {
  id: string;
  workspace_id: string;
  plan_tier: PlanTier;
  messages_limit: number;
  messages_used: number;
  agents_limit: number;
  integrations_enabled: boolean;
  storage_limit_bytes: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  /** When a 30-day trial stops allowing messages. Null unless plan_tier is 'trial'. */
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: StripeSubscriptionStatus | null;
  stripe_current_price_id: string | null;
  stripe_last_event_created_at: number;
  stripe_last_event_id: string | null;
  created_at: string;
  updated_at: string;
}
