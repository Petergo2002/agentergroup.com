-- Atomically replace editable text and reserve its final quota usage. This is
-- intentionally service-role-only: callers must first authenticate and
-- authorize the workspace through the application route.
create or replace function public.update_knowledge_source_text(
  p_workspace_id uuid,
  p_source_id uuid,
  p_raw_text text
)
returns table (
  storage_limit_bytes bigint,
  reserved_total_bytes bigint,
  source_size_bytes bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_limit bigint;
  current_total bigint;
  resolved_source_type text;
  resolved_widget_session_id uuid;
  resolved_status text;
  resolved_size bigint;
begin
  if p_raw_text is null or btrim(p_raw_text) = '' then
    raise exception 'KNOWLEDGE_SOURCE_TEXT_REQUIRED'
      using errcode = '22023';
  end if;

  resolved_size := octet_length(p_raw_text)::bigint;

  if resolved_size > 1048576 then
    raise exception 'KNOWLEDGE_SOURCE_TEXT_TOO_LARGE'
      using errcode = '22023';
  end if;

  -- Use the same workspace lock order as reserve_knowledge_source_storage so
  -- creates, website ingestion, and edits cannot observe stale quota totals.
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text, 0)
  );

  perform 1
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id
  for update;

  select coalesce(workspace_subscriptions.storage_limit_bytes, 10485760)
  into resolved_limit
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id;

  resolved_limit := coalesce(resolved_limit, 10485760);

  select
    knowledge_sources.source_type,
    knowledge_sources.widget_session_id,
    knowledge_sources.status
  into resolved_source_type, resolved_widget_session_id, resolved_status
  from public.knowledge_sources
  where knowledge_sources.id = p_source_id
    and knowledge_sources.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'KNOWLEDGE_SOURCE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if resolved_widget_session_id is not null
    or resolved_source_type not in ('text', 'website') then
    raise exception 'KNOWLEDGE_SOURCE_NOT_EDITABLE'
      using errcode = '22023';
  end if;

  if resolved_status = 'processing' then
    raise exception 'KNOWLEDGE_SOURCE_BUSY'
      using errcode = '55000';
  end if;

  select coalesce(sum(coalesce(knowledge_sources.file_size_bytes, 0)), 0)
  into current_total
  from public.knowledge_sources
  where knowledge_sources.workspace_id = p_workspace_id
    and knowledge_sources.widget_session_id is null
    and knowledge_sources.id <> p_source_id;

  if current_total + resolved_size > resolved_limit then
    raise exception 'KNOWLEDGE_STORAGE_LIMIT_EXCEEDED'
      using errcode = 'P0001';
  end if;

  update public.knowledge_sources
  set
    raw_text = p_raw_text,
    file_size_bytes = resolved_size,
    status = 'processing',
    error_message = null
  where id = p_source_id
    and workspace_id = p_workspace_id;

  return query
  select resolved_limit, current_total + resolved_size, resolved_size;
end;
$$;

revoke all on function public.update_knowledge_source_text(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_knowledge_source_text(uuid, uuid, text)
  to service_role;
