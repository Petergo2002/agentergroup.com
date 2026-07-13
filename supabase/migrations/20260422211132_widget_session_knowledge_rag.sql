-- 1. Add widget_session_id to knowledge_sources
alter table public.knowledge_sources
add column widget_session_id uuid;

-- 2. Add widget_session_id to knowledge_chunks
alter table public.knowledge_chunks
add column widget_session_id uuid;

-- 3. Create indexes for performance and cleanup
create index idx_knowledge_sources_widget_session_id on public.knowledge_sources(widget_session_id) where widget_session_id is not null;
create index idx_knowledge_chunks_widget_session_id on public.knowledge_chunks(widget_session_id) where widget_session_id is not null;

-- 4. Update the match function to include session-scoped knowledge
-- This function now accepts an optional widget_session_id and will search both global and session knowledge.
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
  -- We use a left join for agent mappings because session-scoped knowledge
  -- is bound to a session/workspace, not necessarily explicitly mapped to every agent in advance.
  left join public.agent_knowledge_sources aks
    on aks.knowledge_source_id = ks.id and aks.agent_id = input_agent_id
  where ks.workspace_id = input_workspace_id
    and kc.workspace_id = input_workspace_id
    and ks.status = 'ready'
    -- The source must either be explicitly mapped to the agent OR it must belong to the current user's session
    and (
      aks.id is not null
      or (ks.widget_session_id is not null and ks.widget_session_id = input_widget_session_id)
    )
    and (-1 * (kc.embedding <#> query_embedding)) > match_threshold
  order by kc.embedding <#> query_embedding
  limit least(match_count, 20);
$$;
