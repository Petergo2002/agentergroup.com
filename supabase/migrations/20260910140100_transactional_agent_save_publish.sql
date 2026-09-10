-- Builder save/publish previously ran as several independent Supabase calls
-- (agents.update + agent_drafts.upsert in parallel, then separate connection
-- and knowledge syncs, then a read-latest-version-then-insert for publish).
-- A failure partway through left the agent in a mixed state, and two editors
-- saving/publishing concurrently could silently clobber each other since
-- nothing checked whether the row had changed since it was loaded.
--
-- This follows the existing rollback_agent_v1 pattern (row locks + an
-- updated_at/draft.version optimistic-concurrency check, errcode 40001 on
-- conflict) and the existing replace_agent_connections pattern (security
-- invoker, granted to authenticated, delegates authorization to
-- private.can_edit_agent) to fold each of Save and Publish into one
-- transaction. External side effects (Composio trigger sync) are not part of
-- this RPC and remain a separate best-effort step in the app, matching the
-- existing production-readiness guidance to treat those as a durable
-- follow-up rather than something a DB transaction can cover.

create or replace function public.replace_agent_knowledge_v1(
  p_agent_id uuid,
  p_source_ids uuid[],
  p_folder_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_source_ids uuid[];
  normalized_folder_ids uuid[];
  expected_source_count integer;
  valid_source_count integer;
  expected_folder_count integer;
  valid_folder_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  if not private.can_edit_agent(p_agent_id) then
    raise exception 'Agent not found or access denied.';
  end if;

  select coalesce(array_agg(distinct source_id), '{}'::uuid[])
  into normalized_source_ids
  from unnest(coalesce(p_source_ids, '{}'::uuid[])) as source_id;

  select coalesce(array_agg(distinct folder_id), '{}'::uuid[])
  into normalized_folder_ids
  from unnest(coalesce(p_folder_ids, '{}'::uuid[])) as folder_id;

  expected_source_count := cardinality(normalized_source_ids);
  expected_folder_count := cardinality(normalized_folder_ids);

  select count(*)
  into valid_source_count
  from public.knowledge_sources
  join public.agents on agents.id = p_agent_id
  where knowledge_sources.id = any(normalized_source_ids)
    and knowledge_sources.workspace_id = agents.workspace_id;

  if valid_source_count <> expected_source_count then
    raise exception 'One or more knowledge sources do not belong to this agent workspace.';
  end if;

  select count(*)
  into valid_folder_count
  from public.knowledge_folders
  join public.agents on agents.id = p_agent_id
  where knowledge_folders.id = any(normalized_folder_ids)
    and knowledge_folders.workspace_id = agents.workspace_id;

  if valid_folder_count <> expected_folder_count then
    raise exception 'One or more knowledge folders do not belong to this agent workspace.';
  end if;

  delete from public.agent_knowledge_sources where agent_id = p_agent_id;
  insert into public.agent_knowledge_sources (agent_id, knowledge_source_id)
  select p_agent_id, source_id from unnest(normalized_source_ids) as source_id;

  delete from public.agent_knowledge_folders where agent_id = p_agent_id;
  insert into public.agent_knowledge_folders (agent_id, knowledge_folder_id)
  select p_agent_id, folder_id from unnest(normalized_folder_ids) as folder_id;
end;
$$;

revoke all on function public.replace_agent_knowledge_v1(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.replace_agent_knowledge_v1(uuid, uuid[], uuid[]) to authenticated;

create or replace function public.save_agent_draft_v1(
  p_agent_id uuid,
  p_name text,
  p_description text,
  p_instructions text,
  p_model text,
  p_surface text,
  p_starter_prompts text[],
  p_timezone text,
  p_definition jsonb,
  p_connection_ids uuid[],
  p_knowledge_source_ids uuid[],
  p_knowledge_folder_ids uuid[],
  p_expected_agent_updated_at timestamptz,
  p_expected_draft_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  draft_record public.agent_drafts%rowtype;
  next_status text;
  next_draft_version integer;
  applied_agent_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  if not private.can_edit_agent(p_agent_id) then
    raise exception 'Agent not found or access denied.';
  end if;

  if p_expected_agent_updated_at is null
    or p_expected_draft_version is null
    or p_expected_draft_version < 1 then
    raise exception 'AGENT_SAVE_INVALID_REQUEST' using errcode = '22023';
  end if;

  -- Locking this row first makes it the single serialization point for every
  -- concurrent save/publish on this agent (publish_agent_version_v1 and
  -- rollback_agent_v1 both lock it the same way before touching anything else).
  select * into agent_record from public.agents where id = p_agent_id for update;

  if not found then
    raise exception 'Agent not found or access denied.';
  end if;

  if agent_record.updated_at is distinct from p_expected_agent_updated_at then
    raise exception 'AGENT_SAVE_CONFLICT' using errcode = '40001';
  end if;

  next_status := agent_record.status;
  if agent_record.surface = 'assistant' and agent_record.status = 'draft' then
    next_status := 'active';
  end if;

  update public.agents
  set name = p_name,
      description = p_description,
      instructions = p_instructions,
      model = p_model,
      surface = p_surface,
      starter_prompts = coalesce(p_starter_prompts, '{}'::text[]),
      timezone = p_timezone,
      status = next_status
  where id = p_agent_id
  returning updated_at into applied_agent_updated_at;

  select * into draft_record from public.agent_drafts where agent_id = p_agent_id for update;

  if not found then
    if p_expected_draft_version <> 1 then
      raise exception 'AGENT_DRAFT_CONFLICT' using errcode = '40001';
    end if;

    insert into public.agent_drafts (agent_id, workspace_id, updated_by, definition, version)
    values (p_agent_id, agent_record.workspace_id, auth.uid(), p_definition, 1);

    next_draft_version := 1;
  else
    if draft_record.version <> p_expected_draft_version then
      raise exception 'AGENT_DRAFT_CONFLICT' using errcode = '40001';
    end if;

    next_draft_version := draft_record.version + 1;

    update public.agent_drafts
    set definition = p_definition,
        version = next_draft_version,
        updated_by = auth.uid()
    where agent_id = p_agent_id;
  end if;

  perform public.replace_agent_connections(p_agent_id, p_connection_ids);
  perform public.replace_agent_knowledge_v1(p_agent_id, p_knowledge_source_ids, p_knowledge_folder_ids);

  return jsonb_build_object(
    'updatedAt', applied_agent_updated_at,
    'draftVersion', next_draft_version,
    'status', next_status
  );
end;
$$;

revoke all on function public.save_agent_draft_v1(
  uuid, text, text, text, text, text, text[], text, jsonb, uuid[], uuid[], uuid[], timestamptz, integer
) from public, anon;
grant execute on function public.save_agent_draft_v1(
  uuid, text, text, text, text, text, text[], text, jsonb, uuid[], uuid[], uuid[], timestamptz, integer
) to authenticated;

create or replace function public.publish_agent_version_v1(
  p_agent_id uuid,
  p_definition jsonb,
  p_starter_prompts text[],
  p_name text,
  p_description text,
  p_instructions text,
  p_model text,
  p_expected_agent_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  next_version integer;
  new_version_id uuid;
  applied_agent_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  if not private.can_edit_agent(p_agent_id) then
    raise exception 'Agent not found or access denied.';
  end if;

  if p_expected_agent_updated_at is null then
    raise exception 'AGENT_PUBLISH_INVALID_REQUEST' using errcode = '22023';
  end if;

  -- Same lock as save_agent_draft_v1/rollback_agent_v1: holding it for the
  -- rest of this function serializes concurrent publishes on this agent, so
  -- the next-version computation below never races.
  select * into agent_record from public.agents where id = p_agent_id for update;

  if not found then
    raise exception 'Agent not found or access denied.';
  end if;

  if agent_record.updated_at is distinct from p_expected_agent_updated_at then
    raise exception 'AGENT_PUBLISH_CONFLICT' using errcode = '40001';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.agent_versions
  where agent_id = p_agent_id;

  insert into public.agent_versions (agent_id, workspace_id, version, definition, published_by)
  values (p_agent_id, agent_record.workspace_id, next_version, p_definition, auth.uid())
  returning id into new_version_id;

  update public.agents
  set status = 'active',
      published_version_id = new_version_id,
      name = p_name,
      description = p_description,
      instructions = p_instructions,
      model = p_model,
      starter_prompts = coalesce(p_starter_prompts, '{}'::text[])
  where id = p_agent_id
  returning updated_at into applied_agent_updated_at;

  return jsonb_build_object(
    'updatedAt', applied_agent_updated_at,
    'version', next_version,
    'versionId', new_version_id
  );
end;
$$;

revoke all on function public.publish_agent_version_v1(
  uuid, jsonb, text[], text, text, text, text, timestamptz
) from public, anon;
grant execute on function public.publish_agent_version_v1(
  uuid, jsonb, text[], text, text, text, text, timestamptz
) to authenticated;
