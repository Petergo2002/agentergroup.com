-- UI and route-level count checks are useful feedback but are not entitlement
-- boundaries: authenticated users can call the Data API directly, and two
-- concurrent inserts can both observe stale counts. Serialize each workspace
-- resource and enforce the final invariant in Postgres.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.enforce_agent_plan_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_limit integer;
  active_agent_count bigint;
begin
  if new.archived_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (
      (old.archived_at is not null and new.archived_at is null)
      or new.workspace_id is distinct from old.workspace_id
    ) then
      return new;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('agent-plan-limit:' || new.workspace_id::text, 0)
  );

  select workspace_subscriptions.agents_limit
  into resolved_limit
  from public.workspace_subscriptions
  where workspace_subscriptions.workspace_id = new.workspace_id
  for update;

  resolved_limit := greatest(coalesce(resolved_limit, 1), 0);

  select count(*)
  into active_agent_count
  from public.agents
  where agents.workspace_id = new.workspace_id
    and agents.archived_at is null;

  if active_agent_count >= resolved_limit then
    raise exception 'AGENT_LIMIT_REACHED'
      using
        errcode = 'P0001',
        detail = format(
          'Workspace has %s active agents and the current limit is %s.',
          active_agent_count,
          resolved_limit
        );
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_agent_plan_limit()
  from public, anon, authenticated;

drop trigger if exists agents_enforce_plan_limit on public.agents;
create trigger agents_enforce_plan_limit
before insert or update of archived_at, workspace_id on public.agents
for each row execute function private.enforce_agent_plan_limit();

create or replace function private.enforce_widget_plan_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_plan text;
  resolved_limit integer;
  widget_count bigint;
begin
  if tg_op = 'UPDATE'
    and new.workspace_id is not distinct from old.workspace_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('widget-plan-limit:' || new.workspace_id::text, 0)
  );

  select workspace_subscriptions.plan_tier
  into resolved_plan
  from public.workspace_subscriptions
  where workspace_subscriptions.workspace_id = new.workspace_id
  for update;

  resolved_limit := case coalesce(resolved_plan, 'free')
    when 'premium' then 6
    when 'starter' then 3
    else 1
  end;

  select count(*)
  into widget_count
  from public.widgets
  where widgets.workspace_id = new.workspace_id;

  if widget_count >= resolved_limit then
    raise exception 'WIDGET_LIMIT_REACHED'
      using
        errcode = 'P0001',
        detail = format(
          'Workspace has %s widgets and the current limit is %s.',
          widget_count,
          resolved_limit
        );
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_widget_plan_limit()
  from public, anon, authenticated;

drop trigger if exists widgets_enforce_plan_limit on public.widgets;
create trigger widgets_enforce_plan_limit
before insert or update of workspace_id on public.widgets
for each row execute function private.enforce_widget_plan_limit();
