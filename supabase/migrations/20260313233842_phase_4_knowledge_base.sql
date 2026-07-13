create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  source_type text not null check (source_type in ('text', 'file')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  raw_text text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  chunk_count integer not null default 0,
  last_processed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint knowledge_sources_text_requires_raw_text check (
    (source_type = 'text' and raw_text is not null and storage_path is null)
    or (source_type = 'file' and raw_text is null and storage_path is not null)
  )
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  content_length integer not null,
  embedding extensions.vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_id, chunk_index)
);

create table if not exists public.agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  knowledge_source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (agent_id, knowledge_source_id)
);

create index if not exists knowledge_sources_workspace_id_idx
  on public.knowledge_sources (workspace_id, updated_at desc);
create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source_id, chunk_index);
create index if not exists knowledge_chunks_workspace_idx
  on public.knowledge_chunks (workspace_id);
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_ip_ops);
create index if not exists agent_knowledge_sources_agent_idx
  on public.agent_knowledge_sources (agent_id);

drop trigger if exists knowledge_sources_set_updated_at on public.knowledge_sources;
create trigger knowledge_sources_set_updated_at
before update on public.knowledge_sources
for each row execute procedure public.set_updated_at();

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.agent_knowledge_sources enable row level security;

drop policy if exists "knowledge_sources_member_select" on public.knowledge_sources;
create policy "knowledge_sources_member_select"
on public.knowledge_sources for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "knowledge_sources_member_insert" on public.knowledge_sources;
create policy "knowledge_sources_member_insert"
on public.knowledge_sources for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "knowledge_sources_member_update" on public.knowledge_sources;
create policy "knowledge_sources_member_update"
on public.knowledge_sources for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "knowledge_sources_member_delete" on public.knowledge_sources;
create policy "knowledge_sources_member_delete"
on public.knowledge_sources for delete
using (public.is_workspace_member(workspace_id));

drop policy if exists "knowledge_chunks_member_select" on public.knowledge_chunks;
create policy "knowledge_chunks_member_select"
on public.knowledge_chunks for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "agent_knowledge_sources_member_select" on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_select"
on public.agent_knowledge_sources for select
using (
  exists (
    select 1
    from public.agents
    join public.knowledge_sources on knowledge_sources.id = knowledge_source_id
    where agents.id = agent_id
      and agents.workspace_id = knowledge_sources.workspace_id
      and public.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_knowledge_sources_member_insert" on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_insert"
on public.agent_knowledge_sources for insert
with check (
  exists (
    select 1
    from public.agents
    join public.knowledge_sources on knowledge_sources.id = knowledge_source_id
    where agents.id = agent_id
      and agents.workspace_id = knowledge_sources.workspace_id
      and public.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_knowledge_sources_member_delete" on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_delete"
on public.agent_knowledge_sources for delete
using (
  exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and public.is_workspace_member(agents.workspace_id)
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
  join public.agent_knowledge_sources aks
    on aks.knowledge_source_id = ks.id
  join public.agents a
    on a.id = aks.agent_id
  where kc.workspace_id = input_workspace_id
    and ks.workspace_id = input_workspace_id
    and a.workspace_id = input_workspace_id
    and aks.agent_id = input_agent_id
    and ks.status = 'ready'
    and (-1 * (kc.embedding <#> query_embedding)) > match_threshold
  order by kc.embedding <#> query_embedding
  limit least(match_count, 20);
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-files',
  'knowledge-files',
  false,
  10485760,
  array['text/plain', 'text/markdown', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "knowledge_files_select" on storage.objects;
create policy "knowledge_files_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'knowledge-files'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);

drop policy if exists "knowledge_files_insert" on storage.objects;
create policy "knowledge_files_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'knowledge-files'
  and exists (
    select 1
    from public.knowledge_sources ks
    where ks.id = nullif(split_part(name, '/', 2), '')::uuid
      and ks.workspace_id = nullif(split_part(name, '/', 1), '')::uuid
      and public.is_workspace_member(ks.workspace_id)
  )
);

drop policy if exists "knowledge_files_update" on storage.objects;
create policy "knowledge_files_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'knowledge-files'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
)
with check (
  bucket_id = 'knowledge-files'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);

drop policy if exists "knowledge_files_delete" on storage.objects;
create policy "knowledge_files_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'knowledge-files'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);
