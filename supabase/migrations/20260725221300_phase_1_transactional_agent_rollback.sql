-- Phase 1: restore a published Agent version without exposing a partial-write
-- window between the Agent row and its required draft. The application calls
-- this function with the authenticated actor through a service-role client;
-- tenant membership and edit access are still re-checked inside the transaction.

create or replace function public.rollback_agent_v1(
  p_actor_id uuid,
  p_agent_id uuid,
  p_version_id uuid,
  p_expected_agent_updated_at timestamptz,
  p_expected_draft_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  version_record public.agent_versions%rowtype;
  draft_record public.agent_drafts%rowtype;
  workspace_record public.workspaces%rowtype;
  actor_role text;
  restored_model text;
  restored_instructions text;
  restored_starter_prompts text[];
  restored_timezone text;
  applied_agent_updated_at timestamptz;
begin
  if p_actor_id is null
    or p_agent_id is null
    or p_version_id is null
    or p_expected_agent_updated_at is null
    or p_expected_draft_version is null
    or p_expected_draft_version < 1 then
    raise exception 'AGENT_ROLLBACK_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  -- This function is service-role-only, but retain an actor-binding guard in
  -- case its grants are accidentally broadened in a later migration.
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AGENT_ROLLBACK_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  -- Resolve the tenant, then lock authorization inputs in a stable
  -- workspace -> membership -> Agent order. This prevents membership or
  -- Product-access changes from racing a successful rollback.
  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id;

  if not found then
    raise exception 'AGENT_ROLLBACK_AGENT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select workspaces.*
  into workspace_record
  from public.workspaces
  join public.workspace_members
    on workspace_members.workspace_id = workspaces.id
   and workspace_members.user_id = p_actor_id
  where workspaces.id = agent_record.workspace_id
  for share of workspaces, workspace_members;

  if not found then
    raise exception 'AGENT_ROLLBACK_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  -- The membership row is already share-locked by the authorization query, so
  -- its role cannot change between this read and the lifecycle checks below.
  select workspace_members.role
  into actor_role
  from public.workspace_members
  where workspace_members.workspace_id = workspace_record.id
    and workspace_members.user_id = p_actor_id;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
    and agents.workspace_id = workspace_record.id
  for update;

  if not found then
    raise exception 'AGENT_ROLLBACK_AGENT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if agent_record.kind = 'website'
    and agent_record.surface = 'widget' then
    raise exception 'AGENT_WEBSITE_LIFECYCLE_UNAVAILABLE'
      using errcode = '55000';
  elsif agent_record.kind is null and agent_record.surface = 'widget' then
    null;
  elsif agent_record.kind = 'automation'
    and agent_record.surface = 'automation' then
    if not workspace_record.automations_enabled then
      raise exception 'AGENT_KIND_DISABLED'
        using errcode = '42501';
    end if;
  elsif agent_record.kind = 'assistant'
    and agent_record.surface = 'assistant' then
    if not workspace_record.internal_assistants_enabled then
      raise exception 'AGENT_KIND_DISABLED'
        using errcode = '42501';
    end if;

    if agent_record.created_by <> p_actor_id
      and actor_role not in ('owner', 'admin') then
      raise exception 'AGENT_ROLLBACK_UNAUTHORIZED'
        using errcode = '42501';
    end if;
  else
    raise exception 'AGENT_ROLLBACK_IDENTITY_INVALID'
      using errcode = '23514';
  end if;

  if agent_record.archived_at is not null then
    raise exception 'AGENT_ROLLBACK_ARCHIVED'
      using errcode = '55000';
  end if;

  if agent_record.updated_at is distinct from p_expected_agent_updated_at then
    raise exception 'AGENT_ROLLBACK_CONFLICT'
      using errcode = '40001';
  end if;

  -- The target version must belong to the locked Agent and the same tenant.
  select versions.*
  into version_record
  from public.agent_versions versions
  where versions.id = p_version_id
    and versions.agent_id = agent_record.id
    and versions.workspace_id = agent_record.workspace_id
  for share;

  if not found then
    raise exception 'AGENT_ROLLBACK_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if jsonb_typeof(version_record.definition) is distinct from 'object'
    or jsonb_typeof(
      version_record.definition #> '{config}'
    ) is distinct from 'object' then
    raise exception 'AGENT_ROLLBACK_INVALID_VERSION'
      using errcode = '22023';
  end if;

  -- A draft is a mandatory Agent invariant. Lock it independently because
  -- browser autosave can update the draft without first updating the Agent.
  select drafts.*
  into draft_record
  from public.agent_drafts drafts
  where drafts.agent_id = agent_record.id
    and drafts.workspace_id = agent_record.workspace_id
  for update;

  if not found then
    raise exception 'AGENT_ROLLBACK_PERSISTENCE_FAILED'
      using errcode = '23514';
  end if;

  if draft_record.version <> p_expected_draft_version then
    raise exception 'AGENT_ROLLBACK_CONFLICT'
      using errcode = '40001';
  end if;

  restored_model := agent_record.model;
  if jsonb_typeof(version_record.definition #> '{config,model}') = 'string'
    and char_length(
      btrim(version_record.definition #>> '{config,model}')
    ) between 1 and 200 then
    restored_model := btrim(
      version_record.definition #>> '{config,model}'
    );
  end if;

  restored_instructions := agent_record.instructions;
  if jsonb_typeof(
    version_record.definition #> '{config,instructions}'
  ) = 'string'
    and char_length(
      version_record.definition #>> '{config,instructions}'
    ) <= 20000 then
    restored_instructions :=
      version_record.definition #>> '{config,instructions}';
  end if;

  restored_starter_prompts := agent_record.starter_prompts;
  if jsonb_typeof(
    version_record.definition #> '{config,starterPrompts}'
  ) = 'array' then
    if jsonb_array_length(
      version_record.definition #> '{config,starterPrompts}'
    ) <= 8
      and not exists (
        select 1
        from jsonb_array_elements(
          version_record.definition #> '{config,starterPrompts}'
        ) as prompt(value)
        where jsonb_typeof(prompt.value) <> 'string'
          or char_length(prompt.value #>> '{}') > 200
      ) then
      select coalesce(
        array_agg(prompt.value #>> '{}' order by prompt.ordinality),
        '{}'::text[]
      )
      into restored_starter_prompts
      from jsonb_array_elements(
        version_record.definition #> '{config,starterPrompts}'
      ) with ordinality as prompt(value, ordinality);
    end if;
  end if;

  restored_timezone := agent_record.timezone;
  if jsonb_typeof(
    version_record.definition #> '{config,timezone}'
  ) = 'string'
    and char_length(
      btrim(version_record.definition #>> '{config,timezone}')
    ) between 1 and 100 then
    restored_timezone := btrim(
      version_record.definition #>> '{config,timezone}'
    );
  end if;

  update public.agents
  set
    model = restored_model,
    instructions = restored_instructions,
    starter_prompts = restored_starter_prompts,
    timezone = restored_timezone,
    published_version_id = version_record.id,
    status = 'active'
  where agents.id = agent_record.id
    and agents.workspace_id = agent_record.workspace_id
    and agents.updated_at = p_expected_agent_updated_at
  returning agents.updated_at into applied_agent_updated_at;

  if not found then
    raise exception 'AGENT_ROLLBACK_CONFLICT'
      using errcode = '40001';
  end if;

  update public.agent_drafts
  set
    definition = version_record.definition,
    version = draft_record.version + 1,
    updated_by = p_actor_id
  where agent_drafts.id = draft_record.id
    and agent_drafts.agent_id = agent_record.id
    and agent_drafts.workspace_id = agent_record.workspace_id
    and agent_drafts.version = p_expected_draft_version;

  if not found then
    raise exception 'AGENT_ROLLBACK_CONFLICT'
      using errcode = '40001';
  end if;

  insert into public.audit_logs (
    workspace_id,
    agent_id,
    actor_id,
    action,
    summary,
    metadata
  )
  values (
    agent_record.workspace_id,
    agent_record.id,
    p_actor_id,
    'agent.rollback',
    format('Rolled back the agent to version %s.', version_record.version),
    jsonb_build_object(
      'versionId', version_record.id,
      'version', version_record.version,
      'draftVersion', draft_record.version + 1
    )
  );

  return jsonb_build_object(
    'agentId', agent_record.id,
    'workspaceId', agent_record.workspace_id,
    'versionId', version_record.id,
    'version', version_record.version,
    'draftVersion', draft_record.version + 1,
    'status', 'active',
    'updatedAt', applied_agent_updated_at
  );
end;
$$;

revoke all on function public.rollback_agent_v1(
  uuid,
  uuid,
  uuid,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.rollback_agent_v1(
  uuid,
  uuid,
  uuid,
  timestamptz,
  integer
) to service_role;
