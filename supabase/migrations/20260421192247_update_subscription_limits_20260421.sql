-- Add new limit columns to workspace_subscriptions
ALTER TABLE public.workspace_subscriptions
ADD COLUMN IF NOT EXISTS agents_limit integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS integrations_enabled boolean NOT NULL DEFAULT false;

-- Update existing subscriptions based on plan_tier
UPDATE public.workspace_subscriptions
SET
    agents_limit = CASE
        WHEN plan_tier = 'free' THEN 1
        WHEN plan_tier = 'starter' THEN 3
        WHEN plan_tier = 'premium' THEN 1000 -- Unlimited
        ELSE 1
    END,
    integrations_enabled = CASE
        WHEN plan_tier = 'free' THEN false
        WHEN plan_tier = 'starter' THEN true
        WHEN plan_tier = 'premium' THEN true
        ELSE false
    END;

-- Update the handle_new_workspace_subscription function to set new defaults
CREATE OR REPLACE FUNCTION public.handle_new_workspace_subscription()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_tier, messages_limit, agents_limit, integrations_enabled)
    VALUES (NEW.id, 'free', 50, 1, false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
