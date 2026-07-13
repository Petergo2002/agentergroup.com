do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rate_limit_windows_scope_window_constraint'
      and conrelid = 'public.rate_limit_windows'::regclass
  ) then
    alter table public.rate_limit_windows
      add constraint rate_limit_windows_scope_window_constraint
      unique using index rate_limit_windows_scope_window_key;
  end if;
end;
$$;

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
  on conflict on constraint rate_limit_windows_scope_window_constraint
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
