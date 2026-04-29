create or replace function public.grant_workspace_extra_messages(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_amount integer
)
returns table (
  workspace_id uuid,
  messages_limit integer,
  messages_used integer,
  granted_amount integer
)
language plpgsql
set search_path = public
as $$
begin
  if p_amount not in (50, 100, 500) then
    raise exception 'invalid_extra_message_amount'
      using errcode = '22023';
  end if;

  return query
  with updated_subscription as (
    update public.workspace_subscriptions
    set
      messages_limit = public.workspace_subscriptions.messages_limit + p_amount,
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
      'admin.extra_message_credits.grant',
      'Internal admin granted ' || p_amount::text || ' extra message credits.',
      jsonb_build_object(
        'amount', p_amount,
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
    p_amount
  from updated_subscription;

  if not found then
    raise exception 'workspace_subscription_not_found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.grant_workspace_extra_messages(uuid, uuid, integer) from public;
revoke all on function public.grant_workspace_extra_messages(uuid, uuid, integer) from anon;
revoke all on function public.grant_workspace_extra_messages(uuid, uuid, integer) from authenticated;
grant execute on function public.grant_workspace_extra_messages(uuid, uuid, integer) to service_role;

comment on function public.grant_workspace_extra_messages(uuid, uuid, integer)
  is 'Service-role only helper for internal admins to atomically add fixed extra message credits and write an audit log.';
