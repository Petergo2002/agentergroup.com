alter table if exists public.agents
  add column if not exists surface text;

update public.agents
set surface = 'widget'
where surface is null;

alter table if exists public.agents
  alter column surface set default 'widget',
  alter column surface set not null;

alter table if exists public.agents
  drop constraint if exists agents_surface_check;

alter table if exists public.agents
  add constraint agents_surface_check
  check (surface in ('assistant', 'widget'));

alter table if exists public.chat_threads
  add column if not exists source text,
  add column if not exists active_turn_request_id text,
  add column if not exists active_turn_started_at timestamptz;

update public.chat_threads
set source = 'preview'
where source is null;

alter table if exists public.chat_threads
  alter column source set default 'preview',
  alter column source set not null;

alter table if exists public.chat_threads
  drop constraint if exists chat_threads_source_check;

alter table if exists public.chat_threads
  add constraint chat_threads_source_check
  check (source in ('preview', 'assistant'));

create index if not exists agents_workspace_surface_status_idx
  on public.agents (workspace_id, surface, status, archived_at);

create index if not exists chat_threads_agent_source_updated_at_idx
  on public.chat_threads (agent_id, source, updated_at desc);

create or replace function public.can_edit_agent(
  p_agent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents
    left join public.workspace_members
      on workspace_members.workspace_id = agents.workspace_id
     and workspace_members.user_id = auth.uid()
    where agents.id = p_agent_id
      and (
        (
          agents.surface = 'widget'
          and workspace_members.user_id is not null
        )
        or (
          agents.surface = 'assistant'
          and workspace_members.user_id is not null
          and (
            agents.created_by = auth.uid()
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$$;

drop policy if exists "agents_member_update" on public.agents;
create policy "agents_member_update"
on public.agents for update
using (public.can_edit_agent(id))
with check (public.can_edit_agent(id));

drop policy if exists "agents_member_delete" on public.agents;
create policy "agents_member_delete"
on public.agents for delete
using (public.can_edit_agent(id));

drop policy if exists "agent_drafts_member_access" on public.agent_drafts;

drop policy if exists "agent_drafts_member_select" on public.agent_drafts;
create policy "agent_drafts_member_select"
on public.agent_drafts for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "agent_drafts_member_insert" on public.agent_drafts;
create policy "agent_drafts_member_insert"
on public.agent_drafts for insert
with check (
  public.can_edit_agent(agent_id)
  and public.is_workspace_member(workspace_id)
  and updated_by = (select auth.uid())
);

drop policy if exists "agent_drafts_member_update" on public.agent_drafts;
create policy "agent_drafts_member_update"
on public.agent_drafts for update
using (public.can_edit_agent(agent_id))
with check (
  public.can_edit_agent(agent_id)
  and public.is_workspace_member(workspace_id)
  and updated_by = (select auth.uid())
);

drop policy if exists "agent_drafts_member_delete" on public.agent_drafts;
create policy "agent_drafts_member_delete"
on public.agent_drafts for delete
using (public.can_edit_agent(agent_id));

drop policy if exists "agent_connections_member_insert" on public.agent_connections;
create policy "agent_connections_member_insert"
on public.agent_connections for insert
with check (
  public.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.connections on connections.id = connection_id
    where agents.id = agent_id
      and agents.workspace_id = connections.workspace_id
  )
);

drop policy if exists "agent_connections_member_delete" on public.agent_connections;
create policy "agent_connections_member_delete"
on public.agent_connections for delete
using (public.can_edit_agent(agent_id));

drop policy if exists "agent_knowledge_sources_member_insert" on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_insert"
on public.agent_knowledge_sources for insert
with check (
  public.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.knowledge_sources on knowledge_sources.id = knowledge_source_id
    where agents.id = agent_id
      and agents.workspace_id = knowledge_sources.workspace_id
  )
);

drop policy if exists "agent_knowledge_sources_member_delete" on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_delete"
on public.agent_knowledge_sources for delete
using (public.can_edit_agent(agent_id));

create or replace function public.acquire_chat_thread_turn_lock(
  p_thread_id uuid,
  p_request_id text,
  p_started_at timestamptz,
  p_stale_before timestamptz
)
returns table (
  thread_id uuid,
  source text,
  active_turn_request_id text,
  active_turn_started_at timestamptz,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with locked as (
    update public.chat_threads
    set
      active_turn_request_id = p_request_id,
      active_turn_started_at = p_started_at
    where id = p_thread_id
      and public.chat_threads.source = 'assistant'
      and (
        public.chat_threads.active_turn_request_id is null
        or public.chat_threads.active_turn_started_at is null
        or public.chat_threads.active_turn_started_at < p_stale_before
      )
    returning
      public.chat_threads.id,
      public.chat_threads.source,
      public.chat_threads.active_turn_request_id,
      public.chat_threads.active_turn_started_at
  )
  select
    locked.id,
    locked.source,
    locked.active_turn_request_id,
    locked.active_turn_started_at,
    true
  from locked;

  if found then
    return;
  end if;

  return query
  select
    chat_threads.id,
    chat_threads.source,
    chat_threads.active_turn_request_id,
    chat_threads.active_turn_started_at,
    false
  from public.chat_threads
  where chat_threads.id = p_thread_id
  limit 1;
end;
$$;

create or replace function public.release_chat_thread_turn_lock(
  p_thread_id uuid,
  p_request_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with released as (
    update public.chat_threads
    set
      active_turn_request_id = null,
      active_turn_started_at = null
    where id = p_thread_id
      and public.chat_threads.active_turn_request_id = p_request_id
    returning 1
  )
  select exists(select 1 from released);
$$;
