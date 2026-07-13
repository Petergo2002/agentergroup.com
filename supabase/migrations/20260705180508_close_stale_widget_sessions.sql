create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create index if not exists widget_sessions_active_public_last_seen_idx
on public.widget_sessions (last_seen_at, id)
where status = 'active'
  and source in ('embedded', 'hosted');

create or replace function public.close_stale_widget_sessions(
  p_stale_after interval default interval '30 minutes',
  p_dry_run boolean default false,
  p_limit integer default 5000
)
returns table (
  cutoff_at timestamptz,
  matched_sessions integer,
  completed_sessions integer
)
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_stale_after interval := coalesce(p_stale_after, interval '30 minutes');
  v_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 5000);
  v_cutoff_at timestamptz := now() - v_stale_after;
  v_matched_sessions integer := 0;
  v_completed_sessions integer := 0;
begin
  if v_stale_after < interval '2 minutes' then
    raise exception 'p_stale_after must be at least 2 minutes';
  end if;

  select count(*)::integer
  into v_matched_sessions
  from (
    select sessions.id
    from public.widget_sessions as sessions
    where sessions.status = 'active'
      and sessions.source in ('embedded', 'hosted')
      and sessions.last_seen_at < v_cutoff_at
    order by sessions.last_seen_at asc, sessions.id asc
    limit v_limit
  ) as stale;

  if p_dry_run then
    return query select v_cutoff_at, v_matched_sessions, 0;
    return;
  end if;

  with stale as (
    select
      sessions.id,
      least(
        now(),
        sessions.last_seen_at + v_stale_after
      ) as ended_at
    from public.widget_sessions as sessions
    where sessions.status = 'active'
      and sessions.source in ('embedded', 'hosted')
      and sessions.last_seen_at < v_cutoff_at
    order by sessions.last_seen_at asc, sessions.id asc
    limit v_limit
    for update skip locked
  ),
  updated as (
    update public.widget_sessions as sessions
    set
      status = 'completed',
      ended_at = coalesce(sessions.ended_at, stale.ended_at),
      end_reason = coalesce(sessions.end_reason, 'inactivity_timeout')
    from stale
    where sessions.id = stale.id
      and sessions.status = 'active'
      and sessions.source in ('embedded', 'hosted')
      and sessions.last_seen_at < v_cutoff_at
    returning sessions.id
  )
  select count(*)::integer
  into v_completed_sessions
  from updated;

  return query select v_cutoff_at, v_matched_sessions, v_completed_sessions;
end;
$$;

revoke all on function public.close_stale_widget_sessions(interval, boolean, integer)
from public, anon, authenticated;

grant execute on function public.close_stale_widget_sessions(interval, boolean, integer)
to service_role;

select public.close_stale_widget_sessions(interval '30 minutes', false, 5000);

select cron.unschedule('close-stale-widget-sessions')
where exists (
  select 1
  from cron.job
  where jobname = 'close-stale-widget-sessions'
);

select cron.schedule(
  'close-stale-widget-sessions',
  '*/5 * * * *',
  $cron$
  select public.close_stale_widget_sessions(interval '30 minutes', false, 5000);
  $cron$
);
