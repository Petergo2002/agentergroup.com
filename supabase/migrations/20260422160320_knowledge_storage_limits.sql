-- Add storage_limit_bytes to workspace_subscriptions
ALTER TABLE public.workspace_subscriptions
ADD COLUMN storage_limit_bytes BIGINT NOT NULL DEFAULT 10485760;

-- Update existing subscriptions based on their current plan tier
-- Free: 10MB (10485760)
-- Starter: 25MB (26214400)
-- Premium: 50MB (52428800)
UPDATE public.workspace_subscriptions SET storage_limit_bytes = 10485760 WHERE plan_tier = 'free';
UPDATE public.workspace_subscriptions SET storage_limit_bytes = 26214400 WHERE plan_tier = 'starter';
UPDATE public.workspace_subscriptions SET storage_limit_bytes = 52428800 WHERE plan_tier = 'premium';

COMMENT ON COLUMN public.workspace_subscriptions.storage_limit_bytes IS 'Total knowledge base storage allowed in bytes.';
