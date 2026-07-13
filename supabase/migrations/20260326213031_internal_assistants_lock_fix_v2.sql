create or replace function public.acquire_chat_thread_turn_lock(
  p_thread_id uuid,
  p_request_id text,
  p_started_at timestamptz,
  p_stale_before timestamptz
)
returns table (
  thread_id uuid,
  source text,
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
    update public.chat_threads
    set
      active_turn_request_id = p_request_id,
      active_turn_started_at = p_started_at
    where id = p_thread_id
      and public.chat_threads.source = 'assistant'
      and (
        public.chat_threads.active_turn_request_id is null
        or public.chat_threads.active_turn_started_at is null
        or public.chat_threads.active_turn_started_at < p_stale_before
      )
    returning
      public.chat_threads.id,
      public.chat_threads.source,
      public.chat_threads.active_turn_request_id,
      public.chat_threads.active_turn_started_at
  )
  select
    locked.id,
    locked.source,
    locked.active_turn_request_id,
    locked.active_turn_started_at,
    true
  from locked;

  if found then
    return;
  end if;

  return query
  select
    chat_threads.id,
    chat_threads.source,
    chat_threads.active_turn_request_id,
    chat_threads.active_turn_started_at,
    false
  from public.chat_threads
  where chat_threads.id = p_thread_id
  limit 1;
end;
$$;

create or replace function public.release_chat_thread_turn_lock(
  p_thread_id uuid,
  p_request_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with released as (
    update public.chat_threads
    set
      active_turn_request_id = null,
      active_turn_started_at = null
    where id = p_thread_id
      and public.chat_threads.active_turn_request_id = p_request_id
    returning 1
  )
  select exists(select 1 from released);
$$;
