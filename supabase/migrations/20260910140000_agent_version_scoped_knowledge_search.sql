-- Public chat must ground answers in the sources/folders that were part of
-- the *published* agent version, not whatever the live agent_knowledge_sources
-- / agent_knowledge_folders rows currently say (those mirror the draft and can
-- change before the next publish). This adds a scoped sibling to
-- match_agent_knowledge_chunks that takes an explicit source/folder id list
-- instead of joining the live attachment tables by agent_id. The existing
-- function is untouched, so every other caller keeps today's behavior.
create or replace function public.match_agent_knowledge_chunks_scoped(
  input_workspace_id uuid,
  input_agent_id uuid,
  input_source_ids uuid[],
  input_folder_ids uuid[],
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int,
  input_widget_session_id uuid default null
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_name text,
  content text,
  similarity float,
  chunk_index integer,
  metadata jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  with eligible_sources as (
    select sources.id as source_id
    from public.knowledge_sources sources
    where sources.workspace_id = input_workspace_id
      and sources.id = any (coalesce(input_source_ids, '{}'::uuid[]))

    union

    select kfs.knowledge_source_id as source_id
    from public.knowledge_folders folders
    join public.knowledge_folder_sources kfs
      on kfs.folder_id = folders.id
    join public.knowledge_sources sources
      on sources.id = kfs.knowledge_source_id
    where folders.workspace_id = input_workspace_id
      and folders.id = any (coalesce(input_folder_ids, '{}'::uuid[]))
      and sources.workspace_id = input_workspace_id

    union

    select sources.id as source_id
    from public.knowledge_sources sources
    where input_widget_session_id is not null
      and sources.workspace_id = input_workspace_id
      and sources.widget_session_id = input_widget_session_id
  )
  select
    kc.id as chunk_id,
    ks.id as source_id,
    ks.name as source_name,
    kc.content,
    (-1 * (kc.embedding <#> query_embedding))::float as similarity,
    kc.chunk_index,
    jsonb_build_object(
      'sourceType', ks.source_type,
      'sourceName', ks.name,
      'sourceId', ks.id,
      'chunkIndex', kc.chunk_index
    ) || kc.metadata as metadata
  from public.knowledge_chunks kc
  join public.knowledge_sources ks
    on ks.id = kc.source_id
  join eligible_sources eligible
    on eligible.source_id = ks.id
  join public.agents a
    on a.id = input_agent_id
   and a.workspace_id = input_workspace_id
  where kc.workspace_id = input_workspace_id
    and ks.workspace_id = input_workspace_id
    and ks.status = 'ready'
    and (-1 * (kc.embedding <#> query_embedding)) > match_threshold
  order by kc.embedding <#> query_embedding
  limit least(match_count, 20);
$$;
