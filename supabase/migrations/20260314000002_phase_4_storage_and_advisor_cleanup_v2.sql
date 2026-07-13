create index if not exists agent_connections_connection_id_idx
  on public.agent_connections (connection_id);
create index if not exists agent_drafts_updated_by_idx
  on public.agent_drafts (updated_by);
create index if not exists agent_knowledge_sources_knowledge_source_id_idx
  on public.agent_knowledge_sources (knowledge_source_id);
create index if not exists agent_versions_published_by_idx
  on public.agent_versions (published_by);
create index if not exists agents_archived_by_idx
  on public.agents (archived_by);
create index if not exists agents_created_by_idx
  on public.agents (created_by);
create index if not exists agents_published_version_id_idx
  on public.agents (published_version_id);
create index if not exists audit_logs_actor_id_idx
  on public.audit_logs (actor_id);
create index if not exists audit_logs_agent_id_idx
  on public.audit_logs (agent_id);
create index if not exists audit_logs_run_id_idx
  on public.audit_logs (run_id);
create index if not exists chat_threads_agent_id_idx
  on public.chat_threads (agent_id);
create index if not exists chat_threads_created_by_idx
  on public.chat_threads (created_by);
create index if not exists connections_created_by_idx
  on public.connections (created_by);
create index if not exists knowledge_sources_created_by_idx
  on public.knowledge_sources (created_by);
create index if not exists messages_created_by_idx
  on public.messages (created_by);
create index if not exists messages_workspace_id_idx
  on public.messages (workspace_id);
create index if not exists run_approvals_agent_id_idx
  on public.run_approvals (agent_id);
create index if not exists run_approvals_requested_by_idx
  on public.run_approvals (requested_by);
create index if not exists run_approvals_resolved_by_idx
  on public.run_approvals (resolved_by);
create index if not exists run_approvals_step_id_idx
  on public.run_approvals (step_id);
create index if not exists run_steps_agent_id_idx
  on public.run_steps (agent_id);
create index if not exists runs_created_by_idx
  on public.runs (created_by);
create index if not exists runs_thread_id_idx
  on public.runs (thread_id);
create index if not exists runs_workspace_id_idx
  on public.runs (workspace_id);
create index if not exists workspaces_owner_id_idx
  on public.workspaces (owner_id);

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

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
using (id = (select auth.uid()));

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "workspaces_member_select" on public.workspaces;
create policy "workspaces_member_select"
on public.workspaces for select
using (owner_id = (select auth.uid()) or public.is_workspace_member(id));

drop policy if exists "workspaces_owner_insert" on public.workspaces;
create policy "workspaces_owner_insert"
on public.workspaces for insert
with check (owner_id = (select auth.uid()));

drop policy if exists "workspaces_owner_update" on public.workspaces;
create policy "workspaces_owner_update"
on public.workspaces for update
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "workspace_members_member_select" on public.workspace_members;
create policy "workspace_members_member_select"
on public.workspace_members for select
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "workspace_members_self_insert" on public.workspace_members;
create policy "workspace_members_self_insert"
on public.workspace_members for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
);

drop policy if exists "workspace_members_owner_update" on public.workspace_members;
create policy "workspace_members_owner_update"
on public.workspace_members for update
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
);

drop policy if exists "agents_member_insert" on public.agents;
create policy "agents_member_insert"
on public.agents for insert
with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));

drop policy if exists "agent_drafts_member_access" on public.agent_drafts;
create policy "agent_drafts_member_access"
on public.agent_drafts for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and updated_by = (select auth.uid()));

drop policy if exists "agent_versions_member_insert" on public.agent_versions;
create policy "agent_versions_member_insert"
on public.agent_versions for insert
with check (public.is_workspace_member(workspace_id) and published_by = (select auth.uid()));

drop policy if exists "connections_member_access" on public.connections;
create policy "connections_member_access"
on public.connections for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));

drop policy if exists "chat_threads_member_access" on public.chat_threads;
create policy "chat_threads_member_access"
on public.chat_threads for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));

drop policy if exists "knowledge_sources_member_insert" on public.knowledge_sources;
create policy "knowledge_sources_member_insert"
on public.knowledge_sources for insert
with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));

drop policy if exists "knowledge_files_insert" on storage.objects;
create policy "knowledge_files_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'knowledge-files'
  and exists (
    select 1
    from public.knowledge_sources ks
    where ks.id = nullif(split_part(storage.objects.name, '/', 2), '')::uuid
      and ks.workspace_id = nullif(split_part(storage.objects.name, '/', 1), '')::uuid
      and public.is_workspace_member(ks.workspace_id)
  )
);
