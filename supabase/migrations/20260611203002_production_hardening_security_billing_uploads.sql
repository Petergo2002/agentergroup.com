-- Runtime and audit records are written by trusted server paths. Workspace
-- members may inspect operational history, but cannot forge or rewrite it.
drop policy if exists "audit_logs_member_access" on public.audit_logs;
drop policy if exists "audit_logs_member_select" on public.audit_logs;
create policy "audit_logs_member_select"
on public.audit_logs for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "runs_member_access" on public.runs;
drop policy if exists "runs_member_select" on public.runs;
create policy "runs_member_select"
on public.runs for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "run_steps_member_access" on public.run_steps;
drop policy if exists "run_steps_member_select" on public.run_steps;
create policy "run_steps_member_select"
on public.run_steps for select
to authenticated
using (private.is_workspace_member(workspace_id));

-- Assistant and preview conversations are private to the user who created the
-- thread. Server-side service-role clients retain access for runtime writes.
drop policy if exists "chat_threads_member_access" on public.chat_threads;
drop policy if exists "chat_threads_owner_select" on public.chat_threads;
drop policy if exists "chat_threads_owner_insert" on public.chat_threads;
drop policy if exists "chat_threads_owner_update" on public.chat_threads;
drop policy if exists "chat_threads_owner_delete" on public.chat_threads;

create policy "chat_threads_owner_select"
on public.chat_threads for select
to authenticated
using (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "chat_threads_owner_insert"
on public.chat_threads for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "chat_threads_owner_update"
on public.chat_threads for update
to authenticated
using (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "chat_threads_owner_delete"
on public.chat_threads for delete
to authenticated
using (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

drop policy if exists "messages_member_access" on public.messages;
drop policy if exists "messages_thread_owner_select" on public.messages;
create policy "messages_thread_owner_select"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.chat_threads
    where chat_threads.id = messages.thread_id
      and chat_threads.workspace_id = messages.workspace_id
      and chat_threads.created_by = (select auth.uid())
      and private.is_workspace_member(chat_threads.workspace_id)
  )
);

-- Replacing connection bindings in one SQL function keeps the delete and
-- insert operations in the same transaction. The existing RLS policies and
-- can_edit_agent guard continue to define who may perform the replacement.
create or replace function public.replace_agent_connections(
  p_agent_id uuid,
  p_connection_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_connection_ids uuid[];
  expected_count integer;
  valid_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_edit_agent(p_agent_id) then
    raise exception 'Agent not found or access denied.';
  end if;

  select coalesce(array_agg(distinct connection_id), '{}'::uuid[])
  into normalized_connection_ids
  from unnest(coalesce(p_connection_ids, '{}'::uuid[])) as connection_id;

  expected_count := cardinality(normalized_connection_ids);

  select count(*)
  into valid_count
  from public.connections
  join public.agents on agents.id = p_agent_id
  where connections.id = any(normalized_connection_ids)
    and connections.workspace_id = agents.workspace_id;

  if valid_count <> expected_count then
    raise exception 'One or more connections do not belong to this agent workspace.';
  end if;

  delete from public.agent_connections
  where agent_id = p_agent_id;

  insert into public.agent_connections (agent_id, connection_id)
  select p_agent_id, connection_id
  from unnest(normalized_connection_ids) as connection_id;
end;
$$;

revoke all on function public.replace_agent_connections(uuid, uuid[]) from public, anon;
grant execute on function public.replace_agent_connections(uuid, uuid[]) to authenticated;

-- Service-side quota reservation serializes storage accounting per workspace.
-- This prevents concurrent source creation or website processing from each
-- observing stale usage and collectively exceeding the plan storage limit.
create or replace function public.reserve_knowledge_source_storage(
  p_workspace_id uuid,
  p_source_id uuid,
  p_size_bytes bigint
)
returns table (
  storage_limit_bytes bigint,
  reserved_total_bytes bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_limit bigint;
  current_total bigint;
begin
  if p_size_bytes < 0 then
    raise exception 'Knowledge source size cannot be negative.';
  end if;

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

  if not exists (
    select 1
    from public.knowledge_sources
    where id = p_source_id
      and workspace_id = p_workspace_id
  ) then
    raise exception 'Knowledge source not found.';
  end if;

  select coalesce(sum(coalesce(file_size_bytes, 0)), 0)
  into current_total
  from public.knowledge_sources
  where workspace_id = p_workspace_id
    and widget_session_id is null
    and id <> p_source_id;

  if current_total + p_size_bytes > resolved_limit then
    raise exception 'KNOWLEDGE_STORAGE_LIMIT_EXCEEDED'
      using errcode = 'P0001';
  end if;

  update public.knowledge_sources
  set file_size_bytes = p_size_bytes
  where id = p_source_id
    and workspace_id = p_workspace_id;

  return query
  select resolved_limit, current_total + p_size_bytes;
end;
$$;

revoke all on function public.reserve_knowledge_source_storage(uuid, uuid, bigint)
from public, anon, authenticated;
grant execute on function public.reserve_knowledge_source_storage(uuid, uuid, bigint)
to service_role;
