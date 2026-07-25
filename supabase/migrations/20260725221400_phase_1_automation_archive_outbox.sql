-- Phase 1: make Automation archive a local atomic state transition and move
-- provider trigger cleanup behind a durable, leased desired-state outbox.
-- External provider calls intentionally never run inside this transaction.

alter table public.agent_automations
  drop constraint if exists agent_automations_id_workspace_agent_key;

alter table public.agent_automations
  add constraint agent_automations_id_workspace_agent_key
  unique (id, workspace_id, agent_id);

create table if not exists public.agent_automation_provider_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  automation_id uuid not null,
  provider text not null,
  operation text not null,
  provider_trigger_id text not null,
  desired_state text not null,
  generation bigint not null default 1,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Deliberately no cascading FK to agent_automations. A provider cleanup
  -- command must remain durable even when an activation finishes after the
  -- local Automation or Agent was deleted. Deletion guards below prevent
  -- supported deletes while known cleanup is unresolved.
  constraint agent_automation_provider_outbox_provider_check
    check (provider = 'composio'),
  constraint agent_automation_provider_outbox_operation_check
    check (operation in ('disable_trigger', 'delete_trigger')),
  constraint agent_automation_provider_outbox_desired_state_check
    check (desired_state in ('disabled', 'deleted')),
  constraint agent_automation_provider_outbox_operation_state_check
    check (
      (operation = 'disable_trigger' and desired_state = 'disabled')
      or (operation = 'delete_trigger' and desired_state = 'deleted')
    ),
  constraint agent_automation_provider_outbox_generation_check
    check (generation >= 1),
  constraint agent_automation_provider_outbox_attempt_count_check
    check (attempt_count between 0 and 12),
  constraint agent_automation_provider_outbox_status_check
    check (
      status in (
        'pending',
        'processing',
        'retry_wait',
        'succeeded',
        'dead_letter',
        'cancelled'
      )
    ),
  constraint agent_automation_provider_outbox_lease_check
    check (
      (
        status = 'processing'
        and lease_token is not null
        and lease_expires_at is not null
      )
      or (
        status <> 'processing'
        and lease_token is null
        and lease_expires_at is null
      )
    ),
  unique (automation_id, operation, provider_trigger_id)
);

create index if not exists agent_automation_provider_outbox_claim_idx
  on public.agent_automation_provider_outbox (
    status,
    available_at,
    created_at
  )
  where status in ('pending', 'retry_wait', 'processing');

create index if not exists agent_automation_provider_outbox_workspace_idx
  on public.agent_automation_provider_outbox (
    workspace_id,
    updated_at desc
  );

drop trigger if exists agent_automation_provider_outbox_set_updated_at
  on public.agent_automation_provider_outbox;
create trigger agent_automation_provider_outbox_set_updated_at
before update on public.agent_automation_provider_outbox
for each row execute procedure public.set_updated_at();

alter table public.agent_automation_provider_outbox enable row level security;
revoke all on table public.agent_automation_provider_outbox
  from public, anon, authenticated, service_role;

create table if not exists public.agent_automation_activation_intents (
  automation_id uuid primary key,
  workspace_id uuid not null,
  agent_id uuid not null,
  actor_id uuid not null,
  generation bigint not null default 1,
  status text not null,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_trigger_id text,
  provider_trigger_created boolean,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agent_automation_activation_intents_generation_check
    check (generation >= 1),
  constraint agent_automation_activation_intents_status_check
    check (status in ('prepared', 'finalized', 'cancelled', 'failed')),
  constraint agent_automation_activation_intents_lease_check
    check (
      (
        status = 'prepared'
        and lease_token is not null
        and lease_expires_at is not null
      )
      or (
        status <> 'prepared'
        and lease_token is null
        and lease_expires_at is null
      )
    ),
  constraint agent_automation_activation_intents_trigger_id_check
    check (
      provider_trigger_id is null
      or char_length(provider_trigger_id) between 1 and 500
    )
);

create index if not exists agent_automation_activation_intents_lease_idx
  on public.agent_automation_activation_intents (
    status,
    lease_expires_at
  )
  where status = 'prepared';

drop trigger if exists agent_automation_activation_intents_set_updated_at
  on public.agent_automation_activation_intents;
create trigger agent_automation_activation_intents_set_updated_at
before update on public.agent_automation_activation_intents
for each row execute procedure public.set_updated_at();

alter table public.agent_automation_activation_intents enable row level security;
revoke all on table public.agent_automation_activation_intents
  from public, anon, authenticated, service_role;

create or replace function private.enqueue_agent_automation_provider_cleanup(
  p_workspace_id uuid,
  p_agent_id uuid,
  p_automation_id uuid,
  p_provider_trigger_id text,
  p_operation text,
  p_force_new_generation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox_record public.agent_automation_provider_outbox%rowtype;
  resolved_desired_state text;
begin
  if p_workspace_id is null
    or p_agent_id is null
    or p_automation_id is null
    or p_provider_trigger_id is null
    or char_length(btrim(p_provider_trigger_id)) not between 1 and 500
    or p_operation not in ('disable_trigger', 'delete_trigger')
    or p_force_new_generation is null then
    raise exception 'AUTOMATION_PROVIDER_OUTBOX_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  resolved_desired_state := case
    when p_operation = 'delete_trigger' then 'deleted'
    else 'disabled'
  end;

  select outbox.*
  into outbox_record
  from public.agent_automation_provider_outbox outbox
  where outbox.automation_id = p_automation_id
    and outbox.operation = p_operation
    and outbox.provider_trigger_id = btrim(p_provider_trigger_id)
  for update;

  if not found then
    insert into public.agent_automation_provider_outbox (
      workspace_id,
      agent_id,
      automation_id,
      provider,
      operation,
      provider_trigger_id,
      desired_state,
      status
    )
    values (
      p_workspace_id,
      p_agent_id,
      p_automation_id,
      'composio',
      p_operation,
      btrim(p_provider_trigger_id),
      resolved_desired_state,
      'pending'
    )
    returning * into outbox_record;
  -- A forced desired-state command supersedes even an in-flight generation.
  -- The old worker may still finish its idempotent provider call, but its
  -- generation/lease can no longer complete this row and the replacement
  -- generation will run afterward. This closes enable/disable races.
  elsif p_force_new_generation
    or outbox_record.status in ('cancelled', 'dead_letter') then
    update public.agent_automation_provider_outbox
    set
      workspace_id = p_workspace_id,
      agent_id = p_agent_id,
      desired_state = resolved_desired_state,
      generation = outbox_record.generation + 1,
      status = 'pending',
      attempt_count = 0,
      available_at = timezone('utc', now()),
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      completed_at = null
    where agent_automation_provider_outbox.id = outbox_record.id
    returning * into outbox_record;
  end if;

  return jsonb_build_object(
    'outboxId', outbox_record.id,
    'status', outbox_record.status,
    'generation', outbox_record.generation
  );
end;
$$;

revoke all on function private.enqueue_agent_automation_provider_cleanup(
  uuid,
  uuid,
  uuid,
  text,
  text,
  boolean
) from public, anon, authenticated, service_role;

-- Expand-deploy compatibility backstop: old application nodes still update
-- archive fields directly. Preserve that path until the lifecycle cutover,
-- while making every archive/restore a suspension and ensuring an Automation
-- provider binding cannot survive an archive race.
create or replace function private.capture_agent_archive_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  automation_record public.agent_automations%rowtype;
begin
  if new.archived_at is not distinct from old.archived_at
    and new.archived_by is not distinct from old.archived_by then
    return new;
  end if;

  if new.archived_at is null then
    new.archived_by := null;
  elsif new.archived_by is null then
    raise exception 'AGENT_ARCHIVE_ACTOR_REQUIRED'
      using errcode = '23514';
  elsif auth.uid() is not null and new.archived_by <> auth.uid() then
    raise exception 'AGENT_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  -- Archive and restore are both suspension transitions. Neither path may
  -- implicitly resume an Agent.
  new.status := 'paused';

  if new.kind = 'automation' and new.surface = 'automation' then
    select automations.*
    into automation_record
    from public.agent_automations automations
    where automations.agent_id = new.id
      and automations.workspace_id = new.workspace_id
    for update;

    if found then
      update public.agent_automations
      set status = 'paused'
      where agent_automations.id = automation_record.id
        and agent_automations.workspace_id = new.workspace_id;

      update public.agent_automation_activation_intents
      set
        generation = agent_automation_activation_intents.generation + 1,
        status = 'cancelled',
        lease_token = null,
        lease_expires_at = null,
        completed_at = timezone('utc', now())
      where agent_automation_activation_intents.automation_id
          = automation_record.id
        and agent_automation_activation_intents.status = 'prepared';

      if new.archived_at is not null
        and automation_record.composio_trigger_id is not null then
        perform private.enqueue_agent_automation_provider_cleanup(
          new.workspace_id,
          new.id,
          automation_record.id,
          automation_record.composio_trigger_id,
          'disable_trigger',
          true
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.capture_agent_archive_transition()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_capture_archive_transition
  on public.agents;
create trigger agents_capture_archive_transition
before update of archived_at, archived_by on public.agents
for each row execute function private.capture_agent_archive_transition();

create or replace function private.protect_agent_automation_provider_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if tg_op = 'INSERT'
      and (
        new.composio_trigger_id is not null
        or new.status is distinct from 'draft'
      ) then
      raise exception 'AUTOMATION_PROVIDER_FIELDS_SERVER_OWNED'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
      and (
        new.composio_trigger_id is distinct from old.composio_trigger_id
        or new.status is distinct from old.status
      ) then
      raise exception 'AUTOMATION_PROVIDER_FIELDS_SERVER_OWNED'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_agent_automation_provider_fields()
  from public, anon, authenticated, service_role;

-- Expand-deploy compatibility backstop: an old application node may still
-- finish its legacy two-write activation during a rolling deployment. If an
-- archive won the race, preserve the returned provider id, force the local
-- row paused, and durably request disablement instead of leaving an untracked
-- active trigger.
create or replace function private.capture_archived_automation_provider_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  archived_agent_exists boolean;
  provider_binding_changed boolean := false;
begin
  if current_user::text not in ('anon', 'authenticated', 'service_role') then
    return new;
  end if;

  select exists (
    select 1
    from public.agents
    where agents.id = new.agent_id
      and agents.workspace_id = new.workspace_id
      and agents.archived_at is not null
  )
  into archived_agent_exists;

  if tg_op = 'UPDATE' then
    provider_binding_changed :=
      new.composio_trigger_id is distinct from old.composio_trigger_id;
  end if;

  if archived_agent_exists
    and new.composio_trigger_id is not null
    and (
      new.status in ('provisioning', 'active')
      or provider_binding_changed
    ) then
    perform private.enqueue_agent_automation_provider_cleanup(
      new.workspace_id,
      new.agent_id,
      new.id,
      new.composio_trigger_id,
      'disable_trigger',
      true
    );
    new.status := 'paused';
    new.last_error := 'The Agent was archived during provider activation.';
  end if;

  return new;
end;
$$;

revoke all on function private.capture_archived_automation_provider_transition()
  from public, anon, authenticated, service_role;

drop trigger if exists agent_automations_capture_archived_provider_transition
  on public.agent_automations;
create trigger agent_automations_capture_archived_provider_transition
before insert or update of composio_trigger_id, status
on public.agent_automations
for each row execute function private.capture_archived_automation_provider_transition();

create or replace function private.prevent_archived_agent_reactivation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.archived_at is not null
    and new.status = 'active'
    and current_user::text in ('anon', 'authenticated', 'service_role') then
    raise exception 'AGENT_RESTORE_REQUIRED'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_archived_agent_reactivation()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_prevent_archived_reactivation
  on public.agents;
create trigger agents_prevent_archived_reactivation
before update of status on public.agents
for each row execute function private.prevent_archived_agent_reactivation();

create or replace function private.guard_agent_automation_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.agent_automation_activation_intents intents
    where intents.automation_id = old.id
      and intents.status = 'prepared'
  ) then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_IN_PROGRESS'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.agent_automation_provider_outbox outbox
    where outbox.automation_id = old.id
      and outbox.status not in ('succeeded', 'cancelled')
  ) then
    raise exception 'AUTOMATION_PROVIDER_CLEANUP_REQUIRED'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke all on function private.guard_agent_automation_delete()
  from public, anon, authenticated, service_role;

drop trigger if exists agent_automations_guard_delete
  on public.agent_automations;
create trigger agent_automations_guard_delete
before delete on public.agent_automations
for each row execute function private.guard_agent_automation_delete();

-- The ordinary edit policy excludes archived Agents. During the rolling
-- window, old nodes still need to restore an archived row directly, so expose
-- one narrowly-scoped RLS path which is paired with the trigger below.
create or replace function private.can_restore_agent_during_rollout(
  p_agent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agents
    join public.workspace_members
      on workspace_members.workspace_id = agents.workspace_id
     and workspace_members.user_id = auth.uid()
    join public.workspaces
      on workspaces.id = agents.workspace_id
    where agents.id = p_agent_id
      and agents.archived_at is not null
      and (
        (
          agents.kind is null
          and agents.surface = 'widget'
        )
        or (
          agents.kind = 'website'
          and agents.surface = 'widget'
          and workspaces.website_agents_enabled
        )
        or (
          agents.kind = 'automation'
          and agents.surface = 'automation'
          and workspaces.automations_enabled
        )
        or (
          agents.kind = 'assistant'
          and agents.surface = 'assistant'
          and workspaces.internal_assistants_enabled
          and (
            agents.created_by = auth.uid()
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$$;

revoke all on function private.can_restore_agent_during_rollout(uuid)
  from public, anon;
grant execute on function private.can_restore_agent_during_rollout(uuid)
  to authenticated, service_role;

drop policy if exists "agents_legacy_restore_during_rollout"
  on public.agents;
create policy "agents_legacy_restore_during_rollout"
on public.agents for update
to authenticated
using (private.can_restore_agent_during_rollout(id))
with check (private.can_view_agent(id));

create or replace function private.prevent_archived_agent_authorship()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.archived_at is not null
    and current_user::text in ('anon', 'authenticated', 'service_role') then
    -- A legacy restore may only clear archive state. The preceding transition
    -- trigger forces status to paused and the timestamp trigger owns updated_at.
    if new.archived_at is null
      and new.archived_by is null
      and new.status = 'paused'
      and (
        to_jsonb(new)
          - array['archived_at', 'archived_by', 'status', 'updated_at']
      ) is not distinct from (
        to_jsonb(old)
          - array['archived_at', 'archived_by', 'status', 'updated_at']
      ) then
      return new;
    end if;

    -- Trusted cleanup paths and legacy clients may repeat the safe suspended
    -- state without turning that into a general archived-row edit bypass.
    if new.archived_at is not distinct from old.archived_at
      and new.archived_by is not distinct from old.archived_by
      and new.status = 'paused'
      and (
        to_jsonb(new) - array['status', 'updated_at']
      ) is not distinct from (
        to_jsonb(old) - array['status', 'updated_at']
      ) then
      return new;
    end if;

    raise exception 'AGENT_RESTORE_REQUIRED'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_archived_agent_authorship()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_prevent_archived_authorship
  on public.agents;
create trigger agents_prevent_archived_authorship
before update on public.agents
for each row execute function private.prevent_archived_agent_authorship();

create or replace function private.prevent_archived_automation_authorship()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  agent_is_archived boolean;
begin
  select agents.archived_at is not null
  into agent_is_archived
  from public.agents
  where agents.id = new.agent_id
    and agents.workspace_id = new.workspace_id;

  if coalesce(agent_is_archived, false)
    and current_user::text in ('anon', 'authenticated', 'service_role') then
    if tg_op = 'INSERT' then
      raise exception 'AGENT_RESTORE_REQUIRED'
        using errcode = '55000';
    end if;

    if new.provider is distinct from old.provider
      or new.toolkit_slug is distinct from old.toolkit_slug
      or new.trigger_slug is distinct from old.trigger_slug
      or new.trigger_config is distinct from old.trigger_config
      or (
        new.connection_id is distinct from old.connection_id
        and new.connection_id is not null
      )
      or (
        new.composio_trigger_id is distinct from old.composio_trigger_id
        and new.composio_trigger_id is not null
      )
      or (
        new.status is distinct from old.status
        and new.status in ('provisioning', 'active')
      ) then
      raise exception 'AGENT_RESTORE_REQUIRED'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_archived_automation_authorship()
  from public, anon, authenticated, service_role;

create or replace function private.require_automation_archive_rpc()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
      new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by
    )
    and current_user::text in ('anon', 'authenticated', 'service_role') then
    raise exception 'AGENT_ARCHIVE_RPC_REQUIRED'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.require_automation_archive_rpc()
  from public, anon, authenticated, service_role;

create or replace function public.archive_agent_v1(
  p_actor_id uuid,
  p_agent_id uuid,
  p_archived boolean,
  p_expected_agent_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  workspace_record public.workspaces%rowtype;
  actor_role text;
  has_automation boolean := false;
  state_changed boolean := false;
  cleanup_status text := 'not_required';
  cleanup_result jsonb;
begin
  if p_actor_id is null
    or p_agent_id is null
    or p_archived is null
    or p_expected_agent_updated_at is null then
    raise exception 'AGENT_ARCHIVE_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  -- Service-role callers have no auth.uid(). Keep this binding guard in case a
  -- later migration accidentally broadens execute privileges.
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AGENT_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  if not found then
    raise exception 'AGENT_ARCHIVE_AGENT_NOT_FOUND'
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
    raise exception 'AGENT_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  -- Keep authorization atomic without placing a row variable beside a scalar
  -- in one PL/pgSQL INTO list, which PostgreSQL rejects at function creation.
  select workspace_members.role
  into actor_role
  from public.workspace_members
  where workspace_members.workspace_id = workspace_record.id
    and workspace_members.user_id = p_actor_id;

  if agent_record.kind is null and agent_record.surface = 'widget' then
    null;
  elsif agent_record.kind = 'website'
    and agent_record.surface = 'widget' then
    if not p_archived and not workspace_record.website_agents_enabled then
      raise exception 'AGENT_KIND_DISABLED'
        using errcode = '42501';
    end if;
  elsif agent_record.kind = 'automation'
    and agent_record.surface = 'automation' then
    if not p_archived and not workspace_record.automations_enabled then
      raise exception 'AGENT_KIND_DISABLED'
        using errcode = '42501';
    end if;
  elsif agent_record.kind = 'assistant'
    and agent_record.surface = 'assistant' then
    if not p_archived
      and not workspace_record.internal_assistants_enabled then
      raise exception 'AGENT_KIND_DISABLED'
        using errcode = '42501';
    end if;

    if agent_record.created_by <> p_actor_id
      and actor_role not in ('owner', 'admin') then
      raise exception 'AGENT_ARCHIVE_UNAUTHORIZED'
        using errcode = '42501';
    end if;
  else
    raise exception 'AGENT_ARCHIVE_IDENTITY_INVALID'
      using errcode = '23514';
  end if;

  if agent_record.updated_at is distinct from p_expected_agent_updated_at then
    raise exception 'AGENT_ARCHIVE_CONFLICT'
      using errcode = '40001';
  end if;

  state_changed := (agent_record.archived_at is null) = p_archived;

  if agent_record.kind = 'automation'
    and agent_record.surface = 'automation' then
    select automations.*
    into automation_record
    from public.agent_automations automations
    where automations.agent_id = agent_record.id
      and automations.workspace_id = agent_record.workspace_id
    for update;

    has_automation := found;

    if has_automation and automation_record.status <> 'paused' then
      update public.agent_automations
      set status = 'paused'
      where agent_automations.id = automation_record.id
        and agent_automations.workspace_id = agent_record.workspace_id;

      automation_record.status := 'paused';
    end if;

    if has_automation then
      update public.agent_automation_activation_intents
      set
        generation = agent_automation_activation_intents.generation + 1,
        status = 'cancelled',
        lease_token = null,
        lease_expires_at = null,
        completed_at = timezone('utc', now())
      where agent_automation_activation_intents.automation_id
          = automation_record.id
        and agent_automation_activation_intents.status = 'prepared';
    end if;
  end if;

  if state_changed or agent_record.status <> 'paused' then
    update public.agents
    set
      archived_at = case
        when p_archived then coalesce(
          agents.archived_at,
          timezone('utc', now())
        )
        else null
      end,
      archived_by = case
        when p_archived then coalesce(agents.archived_by, p_actor_id)
        else null
      end,
      -- Archive and restore are suspension operations. Restore never resumes a
      -- previously active Agent or provider binding automatically.
      status = 'paused'
    where agents.id = agent_record.id
      and agents.workspace_id = agent_record.workspace_id
      and agents.updated_at = p_expected_agent_updated_at
    returning agents.* into agent_record;

    if not found then
      raise exception 'AGENT_ARCHIVE_CONFLICT'
        using errcode = '40001';
    end if;
  end if;

  if p_archived
    and has_automation
    and automation_record.composio_trigger_id is not null then
    cleanup_result := private.enqueue_agent_automation_provider_cleanup(
      agent_record.workspace_id,
      agent_record.id,
      automation_record.id,
      automation_record.composio_trigger_id,
      'disable_trigger',
      false
    );
    cleanup_status := cleanup_result ->> 'status';
  end if;

  if state_changed then
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
      case when p_archived then 'agent.archived' else 'agent.restored' end,
      case
        when p_archived then 'Archived an agent.'
        else 'Restored an archived agent.'
      end,
      jsonb_build_object(
        'providerCleanupOutboxId',
        cleanup_result ->> 'outboxId'
      )
    );
  end if;

  return jsonb_build_object(
    'agentId', agent_record.id,
    'workspaceId', agent_record.workspace_id,
    'archived', agent_record.archived_at is not null,
    'archivedAt', agent_record.archived_at,
    'status', agent_record.status,
    'changed', state_changed,
    'updatedAt', agent_record.updated_at,
    'providerCleanup', case
      when cleanup_result is null then jsonb_build_object(
        'required', false,
        'status', 'not_required',
        'outboxId', null,
        'generation', null
      )
      else jsonb_build_object(
        'required', true,
        'status', cleanup_status,
        'outboxId', cleanup_result ->> 'outboxId',
        'generation', (cleanup_result ->> 'generation')::bigint
      )
    end
  );
end;
$$;

revoke all on function public.archive_agent_v1(
  uuid,
  uuid,
  boolean,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.archive_agent_v1(
  uuid,
  uuid,
  boolean,
  timestamptz
) to service_role;

create or replace function public.prepare_automation_provider_activation_v1(
  p_actor_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  intent_record public.agent_automation_activation_intents%rowtype;
  actor_role text;
  automations_enabled boolean;
  next_generation bigint;
  next_lease_token uuid;
  next_lease_expires_at timestamptz;
begin
  if p_actor_id is null or p_agent_id is null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  if not found
    or agent_record.kind is distinct from 'automation'
    or agent_record.surface is distinct from 'automation' then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select
    workspace_members.role,
    workspaces.automations_enabled
  into
    actor_role,
    automations_enabled
  from public.workspace_members
  join public.workspaces
    on workspaces.id = workspace_members.workspace_id
  where workspace_members.workspace_id = agent_record.workspace_id
    and workspace_members.user_id = p_actor_id;

  if actor_role is null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  if not automations_enabled then
    raise exception 'AGENT_KIND_DISABLED'
      using errcode = '42501';
  end if;

  if agent_record.archived_at is not null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_ARCHIVED'
      using errcode = '55000';
  end if;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.agent_id = agent_record.id
    and automations.workspace_id = agent_record.workspace_id
  for update;

  if not found then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if automation_record.composio_trigger_id is not null then
    -- Coordinate activation with worker claims. If prepare locks first, the
    -- pending disable is cancelled before a worker can claim it. If a worker
    -- has already claimed it, this waits and then fails closed on processing.
    perform 1
    from public.agent_automation_provider_outbox outbox
    where outbox.automation_id = automation_record.id
      and outbox.provider_trigger_id
        = automation_record.composio_trigger_id
    for update;

    if exists (
      select 1
      from public.agent_automation_provider_outbox outbox
      where outbox.automation_id = automation_record.id
        and outbox.provider_trigger_id
          = automation_record.composio_trigger_id
        and (
          outbox.status = 'processing'
          or (
            outbox.operation = 'delete_trigger'
            and outbox.status not in ('succeeded', 'cancelled')
          )
        )
    ) then
      raise exception 'AUTOMATION_PROVIDER_CLEANUP_IN_PROGRESS'
        using errcode = '55000';
    end if;

    update public.agent_automation_provider_outbox
    set
      generation = agent_automation_provider_outbox.generation + 1,
      status = 'cancelled',
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      completed_at = timezone('utc', now())
    where agent_automation_provider_outbox.automation_id
        = automation_record.id
      and agent_automation_provider_outbox.provider_trigger_id
        = automation_record.composio_trigger_id
      and agent_automation_provider_outbox.operation = 'disable_trigger'
      and agent_automation_provider_outbox.status in (
        'pending',
        'retry_wait',
        'dead_letter'
      );
  end if;

  select intents.*
  into intent_record
  from public.agent_automation_activation_intents intents
  where intents.automation_id = automation_record.id
  for update;

  if found
    and intent_record.status = 'prepared'
    and intent_record.lease_expires_at > timezone('utc', now()) then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_IN_PROGRESS'
      using errcode = '55000';
  end if;

  next_generation := coalesce(intent_record.generation, 0) + 1;
  next_lease_token := gen_random_uuid();
  next_lease_expires_at := timezone('utc', now()) + interval '5 minutes';

  insert into public.agent_automation_activation_intents (
    automation_id,
    workspace_id,
    agent_id,
    actor_id,
    generation,
    status,
    lease_token,
    lease_expires_at,
    provider_trigger_id,
    provider_trigger_created,
    completed_at
  )
  values (
    automation_record.id,
    agent_record.workspace_id,
    agent_record.id,
    p_actor_id,
    next_generation,
    'prepared',
    next_lease_token,
    next_lease_expires_at,
    null,
    null,
    null
  )
  on conflict (automation_id) do update
  set
    workspace_id = excluded.workspace_id,
    agent_id = excluded.agent_id,
    actor_id = excluded.actor_id,
    generation = excluded.generation,
    status = excluded.status,
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    provider_trigger_id = null,
    provider_trigger_created = null,
    completed_at = null;

  update public.agent_automations
  set
    status = 'provisioning',
    last_error = null
  where agent_automations.id = automation_record.id
    and agent_automations.workspace_id = agent_record.workspace_id;

  update public.agents
  set status = 'paused'
  where agents.id = agent_record.id
    and agents.workspace_id = agent_record.workspace_id;

  return jsonb_build_object(
    'agentId', agent_record.id,
    'automationId', automation_record.id,
    'ready', true,
    'generation', next_generation,
    'leaseToken', next_lease_token,
    'leaseExpiresAt', next_lease_expires_at
  );
end;
$$;

revoke all on function public.prepare_automation_provider_activation_v1(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.prepare_automation_provider_activation_v1(
  uuid,
  uuid
) to service_role;

create or replace function public.finalize_automation_provider_activation_v1(
  p_actor_id uuid,
  p_agent_id uuid,
  p_automation_id uuid,
  p_generation bigint,
  p_lease_token uuid,
  p_provider_trigger_id text,
  p_provider_trigger_created boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  intent_record public.agent_automation_activation_intents%rowtype;
  workspace_enabled boolean := false;
  lease_is_current boolean := false;
  cleanup_result jsonb;
begin
  if p_actor_id is null
    or p_agent_id is null
    or p_automation_id is null
    or p_generation is null
    or p_generation < 1
    or p_lease_token is null
    or p_provider_trigger_id is null
    or char_length(btrim(p_provider_trigger_id)) not between 1 and 500
    or p_provider_trigger_created is null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  -- Keep the same lock order as archive and prepare: Agent, Automation,
  -- activation intent. This makes the final local transition atomic with an
  -- archive that races the external provider request.
  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.id = p_automation_id
  for update;

  select intents.*
  into intent_record
  from public.agent_automation_activation_intents intents
  where intents.automation_id = p_automation_id
  for update;

  if not found
    or intent_record.agent_id <> p_agent_id
    or intent_record.actor_id <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select coalesce(workspaces.automations_enabled, false)
  into workspace_enabled
  from public.workspaces
  where workspaces.id = intent_record.workspace_id;

  lease_is_current := (
    agent_record.id is not null
    and automation_record.id is not null
    and agent_record.workspace_id = intent_record.workspace_id
    and automation_record.workspace_id = intent_record.workspace_id
    and automation_record.agent_id = p_agent_id
    and agent_record.kind = 'automation'
    and agent_record.surface = 'automation'
    and agent_record.archived_at is null
    and workspace_enabled
    and intent_record.status = 'prepared'
    and intent_record.generation = p_generation
    and intent_record.lease_token = p_lease_token
    and intent_record.lease_expires_at > timezone('utc', now())
  );

  if lease_is_current then
    update public.agent_automations
    set
      status = 'active',
      composio_trigger_id = btrim(p_provider_trigger_id),
      last_error = null
    where agent_automations.id = p_automation_id
      and agent_automations.workspace_id = intent_record.workspace_id;

    update public.agents
    set status = 'active'
    where agents.id = p_agent_id
      and agents.workspace_id = intent_record.workspace_id;

    update public.agent_automation_activation_intents
    set
      status = 'finalized',
      lease_token = null,
      lease_expires_at = null,
      provider_trigger_id = btrim(p_provider_trigger_id),
      provider_trigger_created = p_provider_trigger_created,
      completed_at = timezone('utc', now())
    where agent_automation_activation_intents.automation_id
        = p_automation_id;

    return jsonb_build_object(
      'agentId', p_agent_id,
      'automationId', p_automation_id,
      'generation', p_generation,
      'finalized', true,
      'status', 'active',
      'providerCleanup', null
    );
  end if;

  cleanup_result := private.enqueue_agent_automation_provider_cleanup(
    intent_record.workspace_id,
    intent_record.agent_id,
    intent_record.automation_id,
    btrim(p_provider_trigger_id),
    case
      when p_provider_trigger_created then 'delete_trigger'
      else 'disable_trigger'
    end,
    true
  );

  if intent_record.status = 'prepared'
    and intent_record.generation = p_generation
    and intent_record.lease_token = p_lease_token then
    update public.agent_automation_activation_intents
    set
      status = 'failed',
      lease_token = null,
      lease_expires_at = null,
      provider_trigger_id = btrim(p_provider_trigger_id),
      provider_trigger_created = p_provider_trigger_created,
      completed_at = timezone('utc', now())
    where agent_automation_activation_intents.automation_id
        = p_automation_id;
  end if;

  return jsonb_build_object(
    'agentId', p_agent_id,
    'automationId', p_automation_id,
    'generation', p_generation,
    'finalized', false,
    'status', 'paused',
    'providerCleanup', cleanup_result
  );
end;
$$;

revoke all on function public.finalize_automation_provider_activation_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  boolean
) from public, anon, authenticated;
grant execute on function public.finalize_automation_provider_activation_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  boolean
) to service_role;

create or replace function public.abandon_automation_provider_activation_v1(
  p_actor_id uuid,
  p_agent_id uuid,
  p_automation_id uuid,
  p_generation bigint,
  p_lease_token uuid,
  p_provider_trigger_id text,
  p_provider_trigger_created boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  intent_record public.agent_automation_activation_intents%rowtype;
  cleanup_result jsonb;
  lease_matches boolean := false;
begin
  if p_actor_id is null
    or p_agent_id is null
    or p_automation_id is null
    or p_generation is null
    or p_generation < 1
    or p_lease_token is null
    or p_provider_trigger_created is null
    or (
      p_provider_trigger_id is not null
      and char_length(btrim(p_provider_trigger_id)) not between 1 and 500
    ) then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.id = p_automation_id
  for update;

  select intents.*
  into intent_record
  from public.agent_automation_activation_intents intents
  where intents.automation_id = p_automation_id
  for update;

  if not found
    or intent_record.agent_id <> p_agent_id
    or intent_record.actor_id <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if intent_record.status = 'finalized'
    and intent_record.generation = p_generation
    and intent_record.provider_trigger_id
      is not distinct from btrim(p_provider_trigger_id) then
    return jsonb_build_object(
      'agentId', p_agent_id,
      'automationId', p_automation_id,
      'generation', p_generation,
      'alreadyFinalized', true,
      'providerCleanup', null
    );
  end if;

  lease_matches := (
    intent_record.status = 'prepared'
    and intent_record.generation = p_generation
    and intent_record.lease_token = p_lease_token
  );

  if p_provider_trigger_id is not null then
    cleanup_result := private.enqueue_agent_automation_provider_cleanup(
      intent_record.workspace_id,
      intent_record.agent_id,
      intent_record.automation_id,
      btrim(p_provider_trigger_id),
      case
        when p_provider_trigger_created then 'delete_trigger'
        else 'disable_trigger'
      end,
      true
    );
  end if;

  if lease_matches then
    update public.agent_automation_activation_intents
    set
      status = 'failed',
      lease_token = null,
      lease_expires_at = null,
      provider_trigger_id = case
        when p_provider_trigger_id is null then null
        else btrim(p_provider_trigger_id)
      end,
      provider_trigger_created = p_provider_trigger_created,
      completed_at = timezone('utc', now())
    where agent_automation_activation_intents.automation_id
        = p_automation_id;

    if automation_record.id is not null then
      update public.agent_automations
      set
        status = 'error',
        last_error = 'Provider activation did not complete.'
      where agent_automations.id = p_automation_id;
    end if;

    if agent_record.id is not null then
      update public.agents
      set status = 'paused'
      where agents.id = p_agent_id;
    end if;
  end if;

  return jsonb_build_object(
    'agentId', p_agent_id,
    'automationId', p_automation_id,
    'generation', p_generation,
    'alreadyFinalized', false,
    'providerCleanup', cleanup_result
  );
end;
$$;

revoke all on function public.abandon_automation_provider_activation_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  boolean
) from public, anon, authenticated;
grant execute on function public.abandon_automation_provider_activation_v1(
  uuid,
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  boolean
) to service_role;

create or replace function public.cancel_automation_provider_activation_v1(
  p_actor_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  actor_role text;
  cleanup_result jsonb;
begin
  if p_actor_id is null or p_agent_id is null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  if not found
    or agent_record.kind is distinct from 'automation'
    or agent_record.surface is distinct from 'automation' then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select workspace_members.role
  into actor_role
  from public.workspace_members
  where workspace_members.workspace_id = agent_record.workspace_id
    and workspace_members.user_id = p_actor_id;

  if actor_role is null then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.agent_id = agent_record.id
    and automations.workspace_id = agent_record.workspace_id
  for update;

  if not found then
    raise exception 'AUTOMATION_PROVIDER_ACTIVATION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  update public.agent_automation_activation_intents
  set
    generation = agent_automation_activation_intents.generation + 1,
    status = 'cancelled',
    lease_token = null,
    lease_expires_at = null,
    completed_at = timezone('utc', now())
  where agent_automation_activation_intents.automation_id
      = automation_record.id
    and agent_automation_activation_intents.status = 'prepared';

  update public.agent_automations
  set
    status = 'paused',
    last_error = null
  where agent_automations.id = automation_record.id;

  update public.agents
  set status = 'paused'
  where agents.id = agent_record.id;

  if automation_record.composio_trigger_id is not null then
    cleanup_result := private.enqueue_agent_automation_provider_cleanup(
      agent_record.workspace_id,
      agent_record.id,
      automation_record.id,
      automation_record.composio_trigger_id,
      'disable_trigger',
      true
    );
  end if;

  return jsonb_build_object(
    'agentId', agent_record.id,
    'workspaceId', agent_record.workspace_id,
    'automationId', automation_record.id,
    'status', 'paused',
    'providerCleanup', case
      when cleanup_result is null then jsonb_build_object(
        'required', false,
        'status', 'not_required',
        'outboxId', null,
        'generation', null
      )
      else jsonb_build_object(
        'required', true,
        'status', cleanup_result ->> 'status',
        'outboxId', cleanup_result ->> 'outboxId',
        'generation', (cleanup_result ->> 'generation')::bigint
      )
    end
  );
end;
$$;

revoke all on function public.cancel_automation_provider_activation_v1(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.cancel_automation_provider_activation_v1(
  uuid,
  uuid
) to service_role;

create or replace function public.confirm_automation_provider_cleanup_v1(
  p_automation_id uuid,
  p_provider_trigger_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  unresolved_count bigint;
begin
  if p_automation_id is null
    or p_provider_trigger_id is null
    or char_length(btrim(p_provider_trigger_id)) not between 1 and 500 then
    raise exception 'AUTOMATION_PROVIDER_OUTBOX_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  update public.agent_automation_provider_outbox
  set
    status = 'succeeded',
    lease_token = null,
    lease_expires_at = null,
    last_error = null,
    completed_at = timezone('utc', now())
  where agent_automation_provider_outbox.automation_id = p_automation_id
    and agent_automation_provider_outbox.provider_trigger_id
      = btrim(p_provider_trigger_id)
    and agent_automation_provider_outbox.status <> 'processing';

  select count(*)
  into unresolved_count
  from public.agent_automation_provider_outbox outbox
  where outbox.automation_id = p_automation_id
    and outbox.status not in ('succeeded', 'cancelled');

  return jsonb_build_object(
    'automationId', p_automation_id,
    'unresolvedCleanupCount', unresolved_count
  );
end;
$$;

revoke all on function public.confirm_automation_provider_cleanup_v1(
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.confirm_automation_provider_cleanup_v1(
  uuid,
  text
) to service_role;

create or replace function public.purge_agent_automation_v1(
  p_actor_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  cleanup_result jsonb;
  unresolved_count bigint := 0;
begin
  if p_actor_id is null or p_agent_id is null then
    raise exception 'AUTOMATION_PURGE_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AUTOMATION_PURGE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  if not found then
    raise exception 'AUTOMATION_PURGE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = agent_record.workspace_id
      and workspace_members.user_id = p_actor_id
  ) then
    raise exception 'AUTOMATION_PURGE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.agent_id = agent_record.id
    and automations.workspace_id = agent_record.workspace_id
  for update;

  if not found then
    return jsonb_build_object(
      'agentId', agent_record.id,
      'automationId', null,
      'deleted', true,
      'providerCleanup', null
    );
  end if;

  update public.agent_automation_activation_intents
  set
    generation = agent_automation_activation_intents.generation + 1,
    status = 'cancelled',
    lease_token = null,
    lease_expires_at = null,
    completed_at = timezone('utc', now())
  where agent_automation_activation_intents.automation_id
      = automation_record.id
    and agent_automation_activation_intents.status = 'prepared';

  update public.agent_automations
  set status = 'paused'
  where agent_automations.id = automation_record.id;

  update public.agents
  set status = 'paused'
  where agents.id = agent_record.id;

  if automation_record.composio_trigger_id is not null then
    cleanup_result := private.enqueue_agent_automation_provider_cleanup(
      agent_record.workspace_id,
      agent_record.id,
      automation_record.id,
      automation_record.composio_trigger_id,
      'delete_trigger',
      false
    );
  end if;

  select count(*)
  into unresolved_count
  from public.agent_automation_provider_outbox outbox
  where outbox.automation_id = automation_record.id
    and outbox.status not in ('succeeded', 'cancelled');

  if unresolved_count > 0 then
    return jsonb_build_object(
      'agentId', agent_record.id,
      'automationId', automation_record.id,
      'deleted', false,
      'unresolvedCleanupCount', unresolved_count,
      'providerCleanup', cleanup_result
    );
  end if;

  delete from public.agent_automations
  where agent_automations.id = automation_record.id;

  return jsonb_build_object(
    'agentId', agent_record.id,
    'automationId', automation_record.id,
    'deleted', true,
    'unresolvedCleanupCount', 0,
    'providerCleanup', cleanup_result
  );
end;
$$;

revoke all on function public.purge_agent_automation_v1(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.purge_agent_automation_v1(
  uuid,
  uuid
) to service_role;

create or replace function public.purge_agent_v1(
  p_actor_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_record public.agents%rowtype;
  automation_record public.agent_automations%rowtype;
  actor_role text;
  cleanup_result jsonb;
  unresolved_count bigint := 0;
begin
  if p_actor_id is null or p_agent_id is null then
    raise exception 'AGENT_PURGE_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'AGENT_PURGE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select agents.*
  into agent_record
  from public.agents
  where agents.id = p_agent_id
  for update;

  if not found then
    raise exception 'AGENT_PURGE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select workspace_members.role
  into actor_role
  from public.workspace_members
  where workspace_members.workspace_id = agent_record.workspace_id
    and workspace_members.user_id = p_actor_id;

  if actor_role is distinct from 'owner' then
    raise exception 'AGENT_PURGE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  if agent_record.archived_at is null then
    raise exception 'AGENT_PURGE_ARCHIVE_REQUIRED'
      using errcode = '55000';
  end if;

  select automations.*
  into automation_record
  from public.agent_automations automations
  where automations.agent_id = agent_record.id
    and automations.workspace_id = agent_record.workspace_id
  for update;

  if found then
    update public.agent_automation_activation_intents
    set
      generation = agent_automation_activation_intents.generation + 1,
      status = 'cancelled',
      lease_token = null,
      lease_expires_at = null,
      completed_at = timezone('utc', now())
    where agent_automation_activation_intents.automation_id
        = automation_record.id
      and agent_automation_activation_intents.status = 'prepared';

    if automation_record.composio_trigger_id is not null then
      cleanup_result := private.enqueue_agent_automation_provider_cleanup(
        agent_record.workspace_id,
        agent_record.id,
        automation_record.id,
        automation_record.composio_trigger_id,
        'delete_trigger',
        false
      );
    end if;

    select count(*)
    into unresolved_count
    from public.agent_automation_provider_outbox outbox
    where outbox.automation_id = automation_record.id
      and outbox.status not in ('succeeded', 'cancelled');
  end if;

  if unresolved_count > 0 then
    return jsonb_build_object(
      'agentId', agent_record.id,
      'deleted', false,
      'unresolvedCleanupCount', unresolved_count,
      'providerCleanup', cleanup_result
    );
  end if;

  delete from public.agents
  where agents.id = agent_record.id
    and agents.workspace_id = agent_record.workspace_id;

  return jsonb_build_object(
    'agentId', agent_record.id,
    'deleted', true,
    'unresolvedCleanupCount', 0,
    'providerCleanup', cleanup_result
  );
end;
$$;

revoke all on function public.purge_agent_v1(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.purge_agent_v1(
  uuid,
  uuid
) to service_role;

create or replace function public.claim_agent_automation_provider_outbox_v1(
  p_outbox_id uuid,
  p_limit integer
)
returns table (
  outbox_id uuid,
  workspace_id uuid,
  agent_id uuid,
  automation_id uuid,
  provider text,
  operation text,
  provider_trigger_id text,
  desired_state text,
  generation bigint,
  attempt_count integer,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'AUTOMATION_PROVIDER_OUTBOX_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  -- A worker that repeatedly dies after claiming must not create an unbounded
  -- retry counter. Expired final-attempt leases converge to the alarmable
  -- dead-letter state before another provider call is issued.
  update public.agent_automation_provider_outbox
  set
    status = 'dead_letter',
    lease_token = null,
    lease_expires_at = null,
    last_error = coalesce(
      last_error,
      'Provider cleanup worker lease expired at the retry limit.'
    ),
    completed_at = timezone('utc', now())
  where status = 'processing'
    and lease_expires_at <= timezone('utc', now())
    and attempt_count >= 12;

  return query
  with candidates as (
    select outbox.id
    from public.agent_automation_provider_outbox outbox
    where (p_outbox_id is null or outbox.id = p_outbox_id)
      and (
        (
          outbox.status in ('pending', 'retry_wait')
          and outbox.available_at <= timezone('utc', now())
          and outbox.attempt_count < 12
        )
        or (
          outbox.status = 'processing'
          and outbox.lease_expires_at <= timezone('utc', now())
          and outbox.attempt_count < 12
        )
      )
    order by outbox.available_at, outbox.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.agent_automation_provider_outbox outbox
    set
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = timezone('utc', now()) + interval '2 minutes',
      last_error = null
    from candidates
    where outbox.id = candidates.id
    returning outbox.*
  )
  select
    claimed.id,
    claimed.workspace_id,
    claimed.agent_id,
    claimed.automation_id,
    claimed.provider,
    claimed.operation,
    claimed.provider_trigger_id,
    claimed.desired_state,
    claimed.generation,
    claimed.attempt_count,
    claimed.lease_token,
    claimed.lease_expires_at
  from claimed;
end;
$$;

revoke all on function public.claim_agent_automation_provider_outbox_v1(
  uuid,
  integer
) from public, anon, authenticated;
grant execute on function public.claim_agent_automation_provider_outbox_v1(
  uuid,
  integer
) to service_role;

create or replace function public.complete_agent_automation_provider_outbox_v1(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_generation bigint,
  p_succeeded boolean,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox_record public.agent_automation_provider_outbox%rowtype;
  next_status text;
  next_available_at timestamptz;
  retry_delay_seconds integer;
begin
  if p_outbox_id is null
    or p_lease_token is null
    or p_generation is null
    or p_succeeded is null then
    raise exception 'AUTOMATION_PROVIDER_OUTBOX_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  select outbox.*
  into outbox_record
  from public.agent_automation_provider_outbox outbox
  where outbox.id = p_outbox_id
  for update;

  if not found
    or outbox_record.status <> 'processing'
    or outbox_record.lease_token is distinct from p_lease_token
    or outbox_record.generation is distinct from p_generation then
    raise exception 'AUTOMATION_PROVIDER_OUTBOX_LEASE_LOST'
      using errcode = '40001';
  end if;

  if p_succeeded then
    next_status := 'succeeded';
    next_available_at := outbox_record.available_at;
  elsif outbox_record.attempt_count >= 12 then
    next_status := 'dead_letter';
    next_available_at := outbox_record.available_at;
  else
    next_status := 'retry_wait';
    retry_delay_seconds := least(
      3600,
      (30 * power(2, least(outbox_record.attempt_count - 1, 7)))::integer
    );
    next_available_at := timezone('utc', now())
      + make_interval(secs => retry_delay_seconds);
  end if;

  update public.agent_automation_provider_outbox
  set
    status = next_status,
    available_at = next_available_at,
    lease_token = null,
    lease_expires_at = null,
    last_error = case
      when p_succeeded then null
      else left(
        coalesce(nullif(btrim(p_error), ''), 'Provider cleanup failed.'),
        500
      )
    end,
    completed_at = case
      when p_succeeded or next_status = 'dead_letter'
        then timezone('utc', now())
      else null
    end
  where agent_automation_provider_outbox.id = outbox_record.id
  returning * into outbox_record;

  return jsonb_build_object(
    'outboxId', outbox_record.id,
    'status', outbox_record.status,
    'attemptCount', outbox_record.attempt_count,
    'generation', outbox_record.generation,
    'availableAt', outbox_record.available_at,
    'completedAt', outbox_record.completed_at
  );
end;
$$;

revoke all on function public.complete_agent_automation_provider_outbox_v1(
  uuid,
  uuid,
  bigint,
  boolean,
  text
) from public, anon, authenticated;
grant execute on function public.complete_agent_automation_provider_outbox_v1(
  uuid,
  uuid,
  bigint,
  boolean,
  text
) to service_role;

create or replace function public.get_agent_automation_provider_outbox_health_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending', count(*) filter (
      where outbox.status in ('pending', 'retry_wait')
    ),
    'processing', count(*) filter (
      where outbox.status = 'processing'
    ),
    'deadLetter', count(*) filter (
      where outbox.status = 'dead_letter'
    ),
    'oldestReadyAt', min(outbox.available_at) filter (
      where outbox.status in ('pending', 'retry_wait')
    )
  )
  from public.agent_automation_provider_outbox outbox;
$$;

revoke all on function public.get_agent_automation_provider_outbox_health_v1()
  from public, anon, authenticated;
grant execute on function public.get_agent_automation_provider_outbox_health_v1()
  to service_role;
