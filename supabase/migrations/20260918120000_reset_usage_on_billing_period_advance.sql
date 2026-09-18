-- Reset message usage when a Stripe renewal advances the billing period.
--
-- `apply_workspace_subscription_event` moved `billing_cycle_end` forward but
-- never touched `messages_used`, while `increment_workspace_message_usage`
-- only resets usage once the stored cycle end is already in the past. A
-- renewal webhook always lands before the customer's next message, so the
-- cycle end was replaced with a future date and the reset never fired again:
-- a paying customer kept last month's exhausted allowance indefinitely.
--
-- Usage now resets in the same statement that advances the period, and only
-- when the period genuinely moves forward. Replayed events and same-period
-- plan changes carry an unchanged `period_start`, so they never reset usage a
-- second time.

create or replace function public.apply_workspace_subscription_event(
  p_workspace_id uuid,
  p_plan_tier text,
  p_messages_limit integer,
  p_agents_limit integer,
  p_integrations_enabled boolean,
  p_storage_limit_bytes bigint,
  p_subscription_status text,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_event_created_at bigint,
  p_event_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_rows integer;
begin
  if p_plan_tier not in ('free', 'starter', 'premium') then
    raise exception 'Invalid plan tier.';
  end if;

  if p_subscription_status not in (
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused'
  ) then
    raise exception 'Invalid Stripe subscription status.';
  end if;

  update public.workspace_subscriptions
  set
    plan_tier = p_plan_tier,
    messages_limit = p_messages_limit,
    agents_limit = p_agents_limit,
    integrations_enabled = p_integrations_enabled,
    storage_limit_bytes = p_storage_limit_bytes,
    stripe_customer_id = p_customer_id,
    stripe_subscription_id = p_subscription_id,
    stripe_subscription_status = p_subscription_status,
    stripe_current_price_id = p_price_id,
    billing_cycle_start = p_period_start,
    billing_cycle_end = p_period_end,
    -- Only a period that actually moves forward starts a fresh allowance.
    messages_used = case
      when p_period_start is not null
        and (
          billing_cycle_start is null
          or p_period_start > billing_cycle_start
        )
      then 0
      else messages_used
    end,
    stripe_last_event_created_at = p_event_created_at,
    stripe_last_event_id = p_event_id,
    updated_at = timezone('utc', now())
  where workspace_id = p_workspace_id
    and stripe_last_event_created_at <= p_event_created_at;

  get diagnostics updated_rows = row_count;
  return updated_rows = 1;
end;
$$;

revoke all on function public.apply_workspace_subscription_event(
  uuid,
  text,
  integer,
  integer,
  boolean,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  bigint,
  text
) from public, anon, authenticated;

grant execute on function public.apply_workspace_subscription_event(
  uuid,
  text,
  integer,
  integer,
  boolean,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  bigint,
  text
) to service_role;
