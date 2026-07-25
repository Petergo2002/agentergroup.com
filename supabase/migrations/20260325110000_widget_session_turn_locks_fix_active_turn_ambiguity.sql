-- Resolve active-turn identifier ambiguity in the lock RPCs.
create or replace function public.acquire_widget_session_turn_lock(
  p_widget_id uuid,
  p_session_id text,
  p_request_id text,
  p_started_at timestamptz,
  p_stale_before timestamptz
)
returns table (
  widget_session_id uuid,
  status text,
  active_turn_request_id text,
  active_turn_started_at timestamptz,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with locked as (
    update public.widget_sessions
    set
      active_turn_request_id = p_request_id,
      active_turn_started_at = p_started_at,
      last_seen_at = greatest(last_seen_at, p_started_at)
    where widget_id = p_widget_id
      and session_id = p_session_id
      and public.widget_sessions.status <> 'completed'
      and (
        public.widget_sessions.active_turn_request_id is null
        or public.widget_sessions.active_turn_started_at is null
        or public.widget_sessions.active_turn_started_at < p_stale_before
      )
    returning
      id,
      public.widget_sessions.status,
      public.widget_sessions.active_turn_request_id,
      public.widget_sessions.active_turn_started_at
  )
  select
    locked.id,
    locked.status,
    locked.active_turn_request_id,
    locked.active_turn_started_at,
    true
  from locked;

  if found then
    return;
  end if;

  return query
  select
    session.id,
    session.status,
    session.active_turn_request_id,
    session.active_turn_started_at,
    false
  from public.widget_sessions as session
  where session.widget_id = p_widget_id
    and session.session_id = p_session_id
  limit 1;
end;
$$;
