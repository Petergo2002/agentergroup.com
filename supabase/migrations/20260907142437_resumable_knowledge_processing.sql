-- Short, service-only transactions fence stale workers and checkpoint progress.
alter table public.knowledge_sources
  add column processing_token uuid,
  add column processing_expires_at timestamptz;

create function public.claim_knowledge_processing(p_source_id uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_token is null then raise exception 'PROCESSING_TOKEN_REQUIRED'; end if;
  update public.knowledge_sources
  set status = 'processing', error_message = null,
      processing_token = p_token,
      processing_expires_at = clock_timestamp() + interval '3 minutes'
  where id = p_source_id and status <> 'ready'
    and (processing_token is null or processing_expires_at < clock_timestamp());
  return found;
end;
$$;

create function public.checkpoint_knowledge_processing(
  p_source_id uuid, p_token uuid, p_revision text, p_chunks jsonb,
  p_total_chunks integer, p_complete boolean default false
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  src public.knowledge_sources%rowtype;
  completed integer;
begin
  select * into src from public.knowledge_sources where id = p_source_id for update;
  if not found or p_token is null or src.processing_token is distinct from p_token
    or src.processing_expires_at <= clock_timestamp() or src.status <> 'processing' then
    raise exception 'KNOWLEDGE_PROCESSING_LEASE_LOST';
  end if;
  if p_total_chunks is null or p_total_chunks < 1 or p_total_chunks > 20000 or p_revision is null
    or p_chunks is null or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) > 8 then
    raise exception 'INVALID_KNOWLEDGE_CHECKPOINT';
  end if;
  if exists (select 1 from jsonb_array_elements(p_chunks) c
    where (c->>'chunk_index')::integer < 0 or (c->>'chunk_index')::integer >= p_total_chunks
      or length(c->>'content') = 0 or length(c->>'content') > 1400) then
    raise exception 'INVALID_KNOWLEDGE_CHUNK';
  end if;

  insert into public.knowledge_chunks (
    source_id, workspace_id, widget_session_id, chunk_index, content,
    content_length, embedding, metadata
  )
  select src.id, src.workspace_id, src.widget_session_id,
    (c->>'chunk_index')::integer, c->>'content', length(c->>'content'),
    (c->>'embedding')::extensions.vector(384),
    jsonb_build_object('sourceType', src.source_type, 'sourceName', src.name,
      'ingestionVersion', 2, 'ingestionRevision', p_revision)
  from jsonb_array_elements(p_chunks) c
  on conflict (source_id, chunk_index) do update
    set content = excluded.content, content_length = excluded.content_length,
        embedding = excluded.embedding, metadata = excluded.metadata,
        widget_session_id = excluded.widget_session_id;

  select count(*) into completed from public.knowledge_chunks
  where source_id = src.id and metadata->>'ingestionRevision' = p_revision
    and chunk_index >= 0 and chunk_index < p_total_chunks and embedding is not null;

  if p_complete then
    if completed <> p_total_chunks then raise exception 'KNOWLEDGE_CHECKPOINT_INCOMPLETE'; end if;
    -- Stale chunks disappear in the same transaction that publishes the source.
    delete from public.knowledge_chunks where source_id = src.id
      and (metadata->>'ingestionRevision' is distinct from p_revision
        or chunk_index < 0 or chunk_index >= p_total_chunks);
  end if;

  update public.knowledge_sources
  set chunk_count = completed,
      status = case when p_complete then 'ready' else 'processing' end,
      last_processed_at = case when p_complete then clock_timestamp() else last_processed_at end,
      processing_token = case when p_complete then null else processing_token end,
      processing_expires_at = case when p_complete then null else processing_expires_at end,
      error_message = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'processingProgress', jsonb_build_object('completed', completed, 'total', p_total_chunks))
  where id = src.id;
end;
$$;

revoke all on function public.claim_knowledge_processing(uuid, uuid) from public, anon, authenticated;
revoke all on function public.checkpoint_knowledge_processing(uuid, uuid, text, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.claim_knowledge_processing(uuid, uuid) to service_role;
grant execute on function public.checkpoint_knowledge_processing(uuid, uuid, text, jsonb, integer, boolean) to service_role;
