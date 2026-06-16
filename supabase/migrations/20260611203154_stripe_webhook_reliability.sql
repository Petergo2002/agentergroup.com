alter table public.workspace_subscriptions
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_current_price_id text,
  add column if not exists stripe_last_event_created_at bigint not null default 0,
  add column if not exists stripe_last_event_id text;

alter table public.workspace_subscriptions
  drop constraint if exists workspace_subscriptions_stripe_status_check;

alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_stripe_status_check
  check (
    stripe_subscription_status is null
    or stripe_subscription_status in (
      'trialing',
      'active',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  );

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at bigint not null,
  processing_status text not null default 'processing' check (
    processing_status in (
      'processing',
      'processed',
      'failed',
      'requires_review'
    )
  ),
  error_message text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists stripe_webhook_events_status_updated_idx
  on public.stripe_webhook_events (processing_status, updated_at);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

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
