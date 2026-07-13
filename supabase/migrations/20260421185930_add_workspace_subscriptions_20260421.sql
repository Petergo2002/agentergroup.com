-- Create workspace_subscriptions table
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'premium')),
    messages_limit integer NOT NULL DEFAULT 50,
    messages_used integer NOT NULL DEFAULT 0,
    billing_cycle_start timestamp with time zone NOT NULL DEFAULT now(),
    billing_cycle_end timestamp with time zone NOT NULL DEFAULT (now() + interval '1 month'),
    stripe_customer_id text,
    stripe_subscription_id text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for workspace_subscriptions
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_subscriptions_select" ON public.workspace_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspace_subscriptions.workspace_id
            AND workspace_members.user_id = (SELECT auth.uid())
        )
    );

-- Initialize existing workspaces with free plan
INSERT INTO public.workspace_subscriptions (workspace_id, plan_tier, messages_limit)
SELECT id, 'free', 50
FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- Function to auto-create subscription for new workspaces
CREATE OR REPLACE FUNCTION public.handle_new_workspace_subscription()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_tier, messages_limit)
    VALUES (NEW.id, 'free', 50);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_subscription();

-- Function to increment message usage with safety checks
CREATE OR REPLACE FUNCTION public.increment_workspace_message_usage(p_workspace_id uuid)
RETURNS boolean AS $$
DECLARE
    v_sub record;
BEGIN
    -- Select for update to handle concurrent requests
    SELECT * INTO v_sub
    FROM public.workspace_subscriptions
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Fallback: Create one if missing
        INSERT INTO public.workspace_subscriptions (workspace_id, plan_tier, messages_limit)
        VALUES (p_workspace_id, 'free', 50)
        RETURNING * INTO v_sub;
    END IF;

    -- Reset cycle if expired
    IF v_sub.billing_cycle_end <= now() THEN
        UPDATE public.workspace_subscriptions
        SET messages_used = 0,
            billing_cycle_start = now(),
            billing_cycle_end = now() + interval '1 month'
        WHERE workspace_id = p_workspace_id;
        v_sub.messages_used := 0;
    END IF;

    -- Check limit
    IF v_sub.messages_used >= v_sub.messages_limit THEN
        RETURN false;
    END IF;

    -- Increment usage
    UPDATE public.workspace_subscriptions
    SET messages_used = messages_used + 1,
        updated_at = now()
    WHERE workspace_id = p_workspace_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
