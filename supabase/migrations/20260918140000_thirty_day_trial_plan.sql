-- A 30-day trial plan an internal admin can grant during the managed pilot.
--
-- The trial is a fixed window, not a recurring cycle: 500 messages for 30
-- days, after which the workspace stops sending until an admin assigns a
-- paid plan. It is deliberately modelled as its own `plan_tier` rather than
-- as a flag on an existing tier, so every place that already switches on the
-- tier keeps working and the dashboard does not have to call it "Free".

alter table public.workspace_subscriptions
  drop constraint if exists workspace_subscriptions_plan_tier_check;

alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_plan_tier_check
  check (plan_tier = any (array['free'::text, 'starter'::text, 'premium'::text, 'trial'::text]));

-- Null for every workspace that is not on a trial. A trial row with no end
-- date is treated as expired rather than as unlimited: failing closed is the
-- right default for a time-boxed grant.
alter table public.workspace_subscriptions
  add column if not exists trial_ends_at timestamptz;

comment on column public.workspace_subscriptions.trial_ends_at is
  'When a 30-day trial stops allowing messages. Only consulted while plan_tier = ''trial''.';

create or replace function public.increment_workspace_message_usage(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
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

    -- A trial is a fixed window, so it never rolls over.
    --
    -- This has to be decided BEFORE the cycle reset below. A trial's
    -- billing_cycle_end lands on the same day the trial expires, so the reset
    -- would zero the counter and push the cycle out another month — handing
    -- out a fresh 500 messages every month, forever, which is the opposite of
    -- an expiring trial.
    IF v_sub.plan_tier = 'trial' THEN
        IF v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at <= now() THEN
            RETURN false;
        END IF;

        IF v_sub.messages_used >= v_sub.messages_limit THEN
            RETURN false;
        END IF;

        UPDATE public.workspace_subscriptions
        SET messages_used = messages_used + 1,
            updated_at = now()
        WHERE workspace_id = p_workspace_id;

        RETURN true;
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
$function$;
