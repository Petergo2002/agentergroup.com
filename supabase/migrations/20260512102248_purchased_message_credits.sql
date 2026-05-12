create or replace function public.grant_workspace_purchased_messages(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_stripe_session_id text
)
returns table (
  workspace_id uuid,
  messages_limit integer,
  messages_used integer,
  granted_amount integer,
  already_granted boolean
)
language plpgsql
set search_path = public
as $$
begin
  if nullif(trim(p_stripe_session_id), '') is null then
    raise exception 'stripe_session_id_required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_stripe_session_id)::bigint);

  if exists (
    select 1
    from public.audit_logs
    where audit_logs.workspace_id = p_workspace_id
      and audit_logs.action = 'billing.extra_message_credits.purchase'
      and audit_logs.metadata->>'stripe_session_id' = p_stripe_session_id
  ) then
    return query
    select
      workspace_subscriptions.workspace_id,
      workspace_subscriptions.messages_limit,
      workspace_subscriptions.messages_used,
      500,
      true
    from public.workspace_subscriptions
    where workspace_subscriptions.workspace_id = p_workspace_id;

    if not found then
      raise exception 'workspace_subscription_not_found'
        using errcode = 'P0002';
    end if;

    return;
  end if;

  return query
  with updated_subscription as (
    update public.workspace_subscriptions
    set
      messages_limit = public.workspace_subscriptions.messages_limit + 500,
      updated_at = timezone('utc', now())
    where public.workspace_subscriptions.workspace_id = p_workspace_id
    returning
      public.workspace_subscriptions.workspace_id,
      public.workspace_subscriptions.messages_limit,
      public.workspace_subscriptions.messages_used
  ),
  audit_insert as (
    insert into public.audit_logs (
      workspace_id,
      actor_id,
      action,
      summary,
      metadata
    )
    select
      updated_subscription.workspace_id,
      p_actor_id,
      'billing.extra_message_credits.purchase',
      'Workspace purchased 500 extra message credits.',
      jsonb_build_object(
        'amount', 500,
        'stripe_session_id', p_stripe_session_id,
        'messages_limit_after', updated_subscription.messages_limit,
        'messages_used_after', updated_subscription.messages_used
      )
    from updated_subscription
    returning id
  )
  select
    updated_subscription.workspace_id,
    updated_subscription.messages_limit,
    updated_subscription.messages_used,
    500,
    false
  from updated_subscription, audit_insert;

  if not found then
    raise exception 'workspace_subscription_not_found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.grant_workspace_purchased_messages(uuid, uuid, text) from public;
revoke all on function public.grant_workspace_purchased_messages(uuid, uuid, text) from anon;
revoke all on function public.grant_workspace_purchased_messages(uuid, uuid, text) from authenticated;
grant execute on function public.grant_workspace_purchased_messages(uuid, uuid, text) to service_role;

comment on function public.grant_workspace_purchased_messages(uuid, uuid, text)
  is 'Service-role only helper for Stripe-confirmed self-serve 500-message credit purchases. Idempotent by Stripe Checkout session id.';
