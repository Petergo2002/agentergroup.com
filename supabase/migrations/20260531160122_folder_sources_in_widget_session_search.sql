alter table public.knowledge_sources
  add column if not exists widget_session_id uuid references public.widget_sessions (id) on delete cascade;

create index if not exists knowledge_sources_widget_session_idx
  on public.knowledge_sources (widget_session_id)
  where widget_session_id is not null;

create or replace function public.match_agent_knowledge_chunks(
  input_workspace_id uuid,
  input_agent_id uuid,
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
    select aks.knowledge_source_id as source_id
    from public.agent_knowledge_sources aks
    join public.knowledge_sources sources
      on sources.id = aks.knowledge_source_id
    join public.agents agents
      on agents.id = aks.agent_id
    where aks.agent_id = input_agent_id
      and agents.workspace_id = input_workspace_id
      and sources.workspace_id = input_workspace_id

    union

    select kfs.knowledge_source_id as source_id
    from public.agent_knowledge_folders akf
    join public.knowledge_folders folders
      on folders.id = akf.knowledge_folder_id
    join public.knowledge_folder_sources kfs
      on kfs.folder_id = folders.id
    join public.agents agents
      on agents.id = akf.agent_id
    join public.knowledge_sources sources
      on sources.id = kfs.knowledge_source_id
    where akf.agent_id = input_agent_id
      and agents.workspace_id = input_workspace_id
      and folders.workspace_id = input_workspace_id
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
  where kc.workspace_id = input_workspace_id
    and ks.workspace_id = input_workspace_id
    and a.workspace_id = input_workspace_id
    and ks.status = 'ready'
    and (-1 * (kc.embedding <#> query_embedding)) > match_threshold
  order by kc.embedding <#> query_embedding
  limit least(match_count, 20);
$$;

create or replace function public.match_agent_knowledge_chunks(
  input_workspace_id uuid,
  input_agent_id uuid,
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int
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
  select *
  from public.match_agent_knowledge_chunks(
    input_workspace_id,
    input_agent_id,
    query_embedding,
    match_threshold,
    match_count,
    null::uuid
  );
$$;
