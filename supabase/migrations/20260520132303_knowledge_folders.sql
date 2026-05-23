create table if not exists public.knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, name)
);

create table if not exists public.knowledge_folder_sources (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.knowledge_folders (id) on delete cascade,
  knowledge_source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (folder_id, knowledge_source_id)
);

create table if not exists public.agent_knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  knowledge_folder_id uuid not null references public.knowledge_folders (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (agent_id, knowledge_folder_id)
);

create index if not exists knowledge_folders_workspace_updated_idx
  on public.knowledge_folders (workspace_id, updated_at desc);
create index if not exists knowledge_folder_sources_folder_idx
  on public.knowledge_folder_sources (folder_id);
create index if not exists knowledge_folder_sources_source_idx
  on public.knowledge_folder_sources (knowledge_source_id);
create index if not exists agent_knowledge_folders_agent_idx
  on public.agent_knowledge_folders (agent_id);
create index if not exists agent_knowledge_folders_folder_idx
  on public.agent_knowledge_folders (knowledge_folder_id);

drop trigger if exists knowledge_folders_set_updated_at on public.knowledge_folders;
create trigger knowledge_folders_set_updated_at
before update on public.knowledge_folders
for each row execute procedure public.set_updated_at();

alter table public.knowledge_folders enable row level security;
alter table public.knowledge_folder_sources enable row level security;
alter table public.agent_knowledge_folders enable row level security;

drop policy if exists "knowledge_folders_member_select" on public.knowledge_folders;
create policy "knowledge_folders_member_select"
on public.knowledge_folders for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "knowledge_folders_member_insert" on public.knowledge_folders;
create policy "knowledge_folders_member_insert"
on public.knowledge_folders for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists "knowledge_folders_member_update" on public.knowledge_folders;
create policy "knowledge_folders_member_update"
on public.knowledge_folders for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

drop policy if exists "knowledge_folders_member_delete" on public.knowledge_folders;
create policy "knowledge_folders_member_delete"
on public.knowledge_folders for delete
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "knowledge_folder_sources_member_select" on public.knowledge_folder_sources;
create policy "knowledge_folder_sources_member_select"
on public.knowledge_folder_sources for select
to authenticated
using (
  exists (
    select 1
    from public.knowledge_folders folders
    where folders.id = folder_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

drop policy if exists "knowledge_folder_sources_member_insert" on public.knowledge_folder_sources;
create policy "knowledge_folder_sources_member_insert"
on public.knowledge_folder_sources for insert
to authenticated
with check (
  exists (
    select 1
    from public.knowledge_folders folders
    join public.knowledge_sources sources
      on sources.id = knowledge_source_id
    where folders.id = folder_id
      and folders.workspace_id = sources.workspace_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

drop policy if exists "knowledge_folder_sources_member_delete" on public.knowledge_folder_sources;
create policy "knowledge_folder_sources_member_delete"
on public.knowledge_folder_sources for delete
to authenticated
using (
  exists (
    select 1
    from public.knowledge_folders folders
    where folders.id = folder_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

drop policy if exists "agent_knowledge_folders_member_select" on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_select"
on public.agent_knowledge_folders for select
to authenticated
using (
  exists (
    select 1
    from public.agents agents
    join public.knowledge_folders folders
      on folders.id = knowledge_folder_id
    where agents.id = agent_id
      and agents.workspace_id = folders.workspace_id
      and private.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_knowledge_folders_member_insert" on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_insert"
on public.agent_knowledge_folders for insert
to authenticated
with check (
  exists (
    select 1
    from public.agents agents
    join public.knowledge_folders folders
      on folders.id = knowledge_folder_id
    where agents.id = agent_id
      and agents.workspace_id = folders.workspace_id
      and private.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_knowledge_folders_member_delete" on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_delete"
on public.agent_knowledge_folders for delete
to authenticated
using (
  exists (
    select 1
    from public.agents agents
    where agents.id = agent_id
      and private.is_workspace_member(agents.workspace_id)
  )
);

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
  with eligible_sources as (
    select aks.knowledge_source_id as source_id
    from public.agent_knowledge_sources aks
    where aks.agent_id = input_agent_id

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
