-- The public helper was retired by 20260512113836_secure_security_definer_functions,
-- but replace_agent_connections was added later with a stale reference to it.
-- Keep this API function invoker-secured and delegate authorization to the
-- private helper used by the agent RLS policies.
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

  if not private.can_edit_agent(p_agent_id) then
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
