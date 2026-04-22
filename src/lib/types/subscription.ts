export type PlanTier = 'free' | 'starter' | 'premium';

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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}
