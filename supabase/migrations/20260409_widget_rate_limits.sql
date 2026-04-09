create table if not exists public.rate_limit_windows (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null,
  scope_key text not null,
  endpoint text not null,
  window_seconds integer not null check (window_seconds > 0),
  window_started_at timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists rate_limit_windows_scope_window_key
  on public.rate_limit_windows (
    scope_kind,
    scope_key,
    endpoint,
    window_seconds,
    window_started_at
  );

create index if not exists rate_limit_windows_expires_at_idx
  on public.rate_limit_windows (expires_at);

alter table public.rate_limit_windows enable row level security;

revoke all on public.rate_limit_windows from public;
revoke all on public.rate_limit_windows from anon;
revoke all on public.rate_limit_windows from authenticated;

create or replace function public.consume_rate_limit_window(
  p_scope_kind text,
  p_scope_key text,
  p_endpoint text,
  p_window_seconds integer,
  p_limit integer,
  p_now timestamptz default timezone('utc', now())
)
returns table (
  allowed boolean,
  hit_count integer,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  window_started_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_started_at timestamptz;
  v_expires_at timestamptz;
  v_hit_count integer;
  v_retry_after_seconds integer;
begin
  if p_scope_kind is null or btrim(p_scope_kind) = '' then
    raise exception 'p_scope_kind is required';
  end if;

  if p_scope_key is null or btrim(p_scope_key) = '' then
    raise exception 'p_scope_key is required';
  end if;

  if p_endpoint is null or btrim(p_endpoint) = '' then
    raise exception 'p_endpoint is required';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than zero';
  end if;

  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be greater than zero';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_started_at + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_windows (
    scope_kind,
    scope_key,
    endpoint,
    window_seconds,
    window_started_at,
    hit_count,
    expires_at,
    created_at,
    updated_at
  )
  values (
    p_scope_kind,
    p_scope_key,
    p_endpoint,
    p_window_seconds,
    v_window_started_at,
    1,
    v_expires_at,
    p_now,
    p_now
  )
  on conflict (
    scope_kind,
    scope_key,
    endpoint,
    window_seconds,
    window_started_at
  )
  do update
  set
    hit_count = public.rate_limit_windows.hit_count + 1,
    updated_at = p_now
  returning public.rate_limit_windows.hit_count
  into v_hit_count;

  v_retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (v_expires_at - p_now)))::integer
  );

  return query
  select
    v_hit_count <= p_limit,
    v_hit_count,
    p_limit,
    greatest(p_limit - v_hit_count, 0),
    case
      when v_hit_count <= p_limit then 0
      else v_retry_after_seconds
    end,
    v_window_started_at,
    v_expires_at;
end;
$$;

create or replace function public.prune_expired_rate_limit_windows(
  p_expires_before timestamptz default timezone('utc', now())
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_windows
  where expires_at < p_expires_before;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.consume_rate_limit_window(text, text, text, integer, integer, timestamptz) from public;
revoke all on function public.consume_rate_limit_window(text, text, text, integer, integer, timestamptz) from anon;
revoke all on function public.consume_rate_limit_window(text, text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_rate_limit_window(text, text, text, integer, integer, timestamptz) to service_role;

revoke all on function public.prune_expired_rate_limit_windows(timestamptz) from public;
revoke all on function public.prune_expired_rate_limit_windows(timestamptz) from anon;
revoke all on function public.prune_expired_rate_limit_windows(timestamptz) from authenticated;
grant execute on function public.prune_expired_rate_limit_windows(timestamptz) to service_role;
