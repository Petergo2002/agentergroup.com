-- Phase 1B: canonical Agent identity, tenant integrity, and deny-by-default
-- workspace Product access. This migration is intentionally expand-only:
-- legacy Widget agents remain `kind is null` until an explicit classification
-- flow exists.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.agents
  add column if not exists kind text;

alter table public.agents
  drop constraint if exists agents_kind_check;

alter table public.agents
  add constraint agents_kind_check
  check (kind is null or kind in ('website', 'automation', 'assistant'))
  not valid;

update public.agents
set kind = surface
where kind is null
  and surface in ('automation', 'assistant');

alter table public.agents
  validate constraint agents_kind_check;

alter table public.agents
  drop constraint if exists agents_kind_surface_consistency_check;

alter table public.agents
  add constraint agents_kind_surface_consistency_check
  check (
    -- Expand-only compatibility: an old Builder node may still begin an
    -- explicit Widget-to-Automation conversion. The update trigger below
    -- validates and canonicalizes that transition. The cutover migration
    -- removes this nullable Automation representation.
    (kind is null and surface in ('widget', 'automation'))
    or (kind = 'website' and surface = 'widget')
    or (kind = 'automation' and surface = 'automation')
    or (kind = 'assistant' and surface = 'assistant')
  )
  not valid;

alter table public.agents
  validate constraint agents_kind_surface_consistency_check;

alter table public.agents
  drop constraint if exists agents_id_workspace_id_key;

alter table public.agents
  add constraint agents_id_workspace_id_key unique (id, workspace_id);

alter table public.agent_versions
  drop constraint if exists agent_versions_id_agent_workspace_key;

alter table public.agent_versions
  add constraint agent_versions_id_agent_workspace_key
  unique (id, agent_id, workspace_id);

do $$
begin
  if exists (
    select 1
    from public.agent_drafts drafts
    left join public.agents agents
      on agents.id = drafts.agent_id
     and agents.workspace_id = drafts.workspace_id
    where agents.id is null
  ) then
    raise exception 'PHASE_1B_AGENT_DRAFT_WORKSPACE_PREFLIGHT_FAILED'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.agent_versions versions
    left join public.agents agents
      on agents.id = versions.agent_id
     and agents.workspace_id = versions.workspace_id
    where agents.id is null
  ) then
    raise exception 'PHASE_1B_AGENT_VERSION_WORKSPACE_PREFLIGHT_FAILED'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.agent_automations automations
    left join public.agents agents
      on agents.id = automations.agent_id
     and agents.workspace_id = automations.workspace_id
    where agents.id is null
  ) then
    raise exception 'PHASE_1B_AUTOMATION_WORKSPACE_PREFLIGHT_FAILED'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.agents agents
    join public.agent_versions versions
      on versions.id = agents.published_version_id
    where versions.agent_id <> agents.id
       or versions.workspace_id <> agents.workspace_id
  ) then
    raise exception 'PHASE_1B_PUBLISHED_VERSION_PREFLIGHT_FAILED'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.agent_drafts
  drop constraint if exists agent_drafts_agent_workspace_fkey;

alter table public.agent_drafts
  add constraint agent_drafts_agent_workspace_fkey
  foreign key (agent_id, workspace_id)
  references public.agents (id, workspace_id)
  not valid;

alter table public.agent_drafts
  validate constraint agent_drafts_agent_workspace_fkey;

alter table public.agent_versions
  drop constraint if exists agent_versions_agent_workspace_fkey;

alter table public.agent_versions
  add constraint agent_versions_agent_workspace_fkey
  foreign key (agent_id, workspace_id)
  references public.agents (id, workspace_id)
  not valid;

alter table public.agent_versions
  validate constraint agent_versions_agent_workspace_fkey;

alter table public.agent_automations
  drop constraint if exists agent_automations_agent_workspace_fkey;

alter table public.agent_automations
  add constraint agent_automations_agent_workspace_fkey
  foreign key (agent_id, workspace_id)
  references public.agents (id, workspace_id)
  not valid;

alter table public.agent_automations
  validate constraint agent_automations_agent_workspace_fkey;

alter table public.agents
  drop constraint if exists agents_published_version_identity_fkey;

alter table public.agents
  add constraint agents_published_version_identity_fkey
  foreign key (published_version_id, id, workspace_id)
  references public.agent_versions (id, agent_id, workspace_id)
  not valid;

alter table public.agents
  validate constraint agents_published_version_identity_fkey;

alter table public.agent_library_templates
  add column if not exists kind text;

alter table public.agent_library_templates
  drop constraint if exists agent_library_templates_kind_check;

alter table public.agent_library_templates
  add constraint agent_library_templates_kind_check
  check (kind is null or kind in ('website', 'automation', 'assistant'))
  not valid;

update public.agent_library_templates
set kind = surface
where kind is null
  and surface in ('automation', 'assistant');

alter table public.agent_library_templates
  validate constraint agent_library_templates_kind_check;

alter table public.agent_library_templates
  drop constraint if exists agent_library_templates_kind_surface_check;

alter table public.agent_library_templates
  add constraint agent_library_templates_kind_surface_check
  check (
    (kind is null and surface = 'widget')
    or (kind = 'website' and surface = 'widget')
    or (kind = 'automation' and surface = 'automation')
    or (kind = 'assistant' and surface = 'assistant')
  )
  not valid;

alter table public.agent_library_templates
  validate constraint agent_library_templates_kind_surface_check;

alter table public.workspaces
  add column if not exists website_agents_enabled boolean not null default false,
  add column if not exists agent_site_private_preview_enabled boolean not null default false;

-- Product access is an internal administrative control, not a workspace setting.
-- The owner RLS policy intentionally permits ordinary workspace edits, so a
-- trigger backstop prevents Data API clients from self-enabling any entitlement.
create or replace function private.protect_workspace_product_access_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and (
      new.website_agents_enabled
      or new.agent_site_private_preview_enabled
      or new.automations_enabled
      or new.internal_assistants_enabled
    ) then
      raise exception 'WORKSPACE_PRODUCT_ACCESS_SERVICE_OWNED'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and (
      new.website_agents_enabled is distinct from old.website_agents_enabled
      or new.agent_site_private_preview_enabled
        is distinct from old.agent_site_private_preview_enabled
      or new.automations_enabled is distinct from old.automations_enabled
      or new.internal_assistants_enabled
        is distinct from old.internal_assistants_enabled
    ) then
      raise exception 'WORKSPACE_PRODUCT_ACCESS_SERVICE_OWNED'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_workspace_product_access_fields()
  from public, anon, authenticated, service_role;

drop trigger if exists workspaces_protect_product_access_fields
  on public.workspaces;
create trigger workspaces_protect_product_access_fields
before insert or update on public.workspaces
for each row
execute function private.protect_workspace_product_access_fields();

create or replace function private.workspace_agent_kind_enabled(
  p_workspace_id uuid,
  p_kind text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case p_kind
        when 'website' then workspaces.website_agents_enabled
        when 'automation' then workspaces.automations_enabled
        when 'assistant' then workspaces.internal_assistants_enabled
        else false
      end
      from public.workspaces
      where workspaces.id = p_workspace_id
    ),
    false
  );
$$;

revoke all on function private.workspace_agent_kind_enabled(uuid, text)
  from public, anon;
grant execute on function private.workspace_agent_kind_enabled(uuid, text)
  to authenticated, service_role;

create or replace function private.resolve_agent_create_access(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_kind text
)
returns table (
  allowed boolean,
  reason text,
  membership_role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_role text;
begin
  if p_actor_id is null then
    return query select false, 'unauthorized'::text, null::text;
    return;
  end if;

  if p_kind not in ('website', 'automation', 'assistant') then
    return query select false, 'agent_kind_unknown'::text, null::text;
    return;
  end if;

  select members.role
  into resolved_role
  from public.workspace_members members
  where members.workspace_id = p_workspace_id
    and members.user_id = p_actor_id;

  if resolved_role is null then
    return query
      select false, 'workspace_access_denied'::text, null::text;
    return;
  end if;

  if not private.workspace_agent_kind_enabled(p_workspace_id, p_kind) then
    return query
      select false, 'agent_kind_disabled'::text, resolved_role;
    return;
  end if;

  if p_kind = 'assistant' and resolved_role not in ('owner', 'admin') then
    return query
      select false, 'workspace_access_denied'::text, resolved_role;
    return;
  end if;

  return query select true, 'allowed'::text, resolved_role;
end;
$$;

revoke all on function private.resolve_agent_create_access(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.resolve_agent_create_access(uuid, uuid, text)
  to service_role;

create or replace function public.get_agent_product_bootstrap_v1(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  website_enabled boolean;
  automation_enabled boolean;
  assistant_enabled boolean;
  preview_enabled boolean;
  actor_role text;
begin
  if actor_id is null then
    raise exception 'AGENT_PRODUCT_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select
    members.role,
    workspaces.website_agents_enabled,
    workspaces.automations_enabled,
    workspaces.internal_assistants_enabled,
    workspaces.agent_site_private_preview_enabled
  into
    actor_role,
    website_enabled,
    automation_enabled,
    assistant_enabled,
    preview_enabled
  from public.workspace_members members
  join public.workspaces
    on workspaces.id = members.workspace_id
  where members.workspace_id = p_workspace_id
    and members.user_id = actor_id;

  if actor_role is null then
    raise exception 'AGENT_PRODUCT_WORKSPACE_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'workspaceId', p_workspace_id,
    'kinds', jsonb_build_array(
      jsonb_build_object(
        'kind', 'website',
        'reason', case when website_enabled then 'allowed' else 'agent_kind_disabled' end,
        'operations', jsonb_build_object(
          'discover', website_enabled,
          'create', website_enabled,
          'view', website_enabled,
          'edit', website_enabled,
          'publish', false,
          'execute', website_enabled and preview_enabled,
          'deliver_publicly', false,
          'suspend', website_enabled,
          'restore', website_enabled
        ),
        'privatePreviewAllowed', website_enabled and preview_enabled
      ),
      jsonb_build_object(
        'kind', 'automation',
        'reason', case when automation_enabled then 'allowed' else 'agent_kind_disabled' end,
        'operations', jsonb_build_object(
          'discover', automation_enabled,
          'create', automation_enabled,
          'view', automation_enabled,
          'edit', automation_enabled,
          'publish', automation_enabled,
          'execute', automation_enabled,
          'deliver_publicly', false,
          'suspend', automation_enabled,
          'restore', automation_enabled
        ),
        'privatePreviewAllowed', false
      ),
      jsonb_build_object(
        'kind', 'assistant',
        'reason', case
          when assistant_enabled and actor_role in ('owner', 'admin') then 'allowed'
          when assistant_enabled then 'workspace_access_denied'
          else 'agent_kind_disabled'
        end,
        'operations', jsonb_build_object(
          'discover', assistant_enabled and actor_role in ('owner', 'admin'),
          'create', assistant_enabled and actor_role in ('owner', 'admin'),
          'view', assistant_enabled,
          'edit', assistant_enabled,
          'publish', false,
          'execute', assistant_enabled,
          'deliver_publicly', false,
          'suspend', assistant_enabled,
          'restore', assistant_enabled
        ),
        'privatePreviewAllowed', false
      )
    )
  );
end;
$$;

revoke all on function public.get_agent_product_bootstrap_v1(uuid)
  from public, anon;
grant execute on function public.get_agent_product_bootstrap_v1(uuid)
  to authenticated, service_role;

-- During the mixed-version window, older clients may still omit `kind`.
-- Preserve their existing Automation/Assistant behavior by normalizing those
-- unambiguous legacy surfaces, but never allow a Data API caller to assert a
-- canonical kind directly. Canonical Website creation is service-RPC-only.
create or replace function private.protect_agent_creation_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role text;
  automation_enabled boolean;
  assistant_enabled boolean;
begin
  if current_user::text in ('anon', 'authenticated', 'service_role') then
    if new.kind is not null then
      raise exception 'AGENT_CANONICAL_CREATION_RPC_REQUIRED'
        using errcode = '42501';
    end if;

    if new.surface in ('automation', 'assistant') then
      actor_id := case
        when current_user::text = 'service_role' then new.created_by
        else auth.uid()
      end;

      select
        workspaces.automations_enabled,
        workspaces.internal_assistants_enabled
      into
        automation_enabled,
        assistant_enabled
      from public.workspaces
      where workspaces.id = new.workspace_id
      for share;

      if not found then
        raise exception 'AGENT_CREATE_UNAUTHORIZED'
          using errcode = '42501';
      end if;

      select members.role
      into actor_role
      from public.workspace_members members
      where members.workspace_id = new.workspace_id
        and members.user_id = actor_id
      for share;

      if actor_role is null then
        raise exception 'AGENT_CREATE_UNAUTHORIZED'
          using errcode = '42501';
      end if;

      if new.surface = 'automation'
        and not coalesce(automation_enabled, false) then
        raise exception 'AGENT_KIND_DISABLED'
          using errcode = '42501';
      end if;

      if new.surface = 'assistant'
        and not coalesce(assistant_enabled, false) then
        raise exception 'AGENT_KIND_DISABLED'
          using errcode = '42501';
      end if;

      if new.surface = 'assistant'
        and actor_role not in ('owner', 'admin') then
        raise exception 'AGENT_CREATE_UNAUTHORIZED'
          using errcode = '42501';
      end if;

      new.kind := new.surface;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_agent_creation_boundary()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_protect_creation_boundary on public.agents;
create trigger agents_protect_creation_boundary
before insert on public.agents
for each row execute function private.protect_agent_creation_boundary();

create or replace function private.protect_agent_identity_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  actor_role text;
  automation_enabled boolean;
  legacy_automation_conversion boolean := false;
begin
  if current_user::text in ('anon', 'authenticated', 'service_role') then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.created_by is distinct from old.created_by then
      raise exception 'Agent identity and tenant fields are immutable.'
        using errcode = '42501';
    end if;

    legacy_automation_conversion := (
      old.kind is null
      and old.surface = 'widget'
      and old.archived_at is null
      and new.kind is null
      and new.surface = 'automation'
    );

    if legacy_automation_conversion then
      actor_id := case
        when current_user::text = 'service_role' then old.created_by
        else auth.uid()
      end;

      select workspaces.automations_enabled
      into automation_enabled
      from public.workspaces
      where workspaces.id = old.workspace_id
      for share;

      if not found then
        raise exception 'AGENT_CREATE_UNAUTHORIZED'
          using errcode = '42501';
      end if;

      select members.role
      into actor_role
      from public.workspace_members members
      where members.workspace_id = old.workspace_id
        and members.user_id = actor_id
      for share;

      if actor_role is null then
        raise exception 'AGENT_CREATE_UNAUTHORIZED'
          using errcode = '42501';
      end if;

      if not coalesce(automation_enabled, false) then
        raise exception 'AGENT_KIND_DISABLED'
          using errcode = '42501';
      end if;

      -- The old client writes only `surface`. Canonicalize the explicit
      -- one-way conversion in the same transaction so no null-kind Automation
      -- can escape into lifecycle or provider code.
      new.kind := 'automation';
    elsif new.surface is distinct from old.surface then
      raise exception 'Agent compatibility surfaces are immutable.'
        using errcode = '42501';
    end if;

    if new.kind is distinct from old.kind
      and not legacy_automation_conversion then
      raise exception 'Canonical Agent kinds are immutable.'
        using errcode = '42501';
    end if;

    if (
      old.kind = 'website'
      or new.kind = 'website'
    ) and (
      new.published_version_id is distinct from old.published_version_id
      or (
        new.status is distinct from old.status
        and not (
          new.status = 'paused'
          and (
            old.archived_at is not null
            or new.archived_at is distinct from old.archived_at
            or new.archived_by is distinct from old.archived_by
          )
        )
      )
    ) then
      raise exception 'AGENT_WEBSITE_LIFECYCLE_UNAVAILABLE'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_agent_identity_fields()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_protect_identity_fields on public.agents;
create trigger agents_protect_identity_fields
before update on public.agents
for each row execute function private.protect_agent_identity_fields();

create or replace function private.protect_website_agent_versions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated', 'service_role')
    and exists (
      select 1
      from public.agents
      where agents.id = new.agent_id
        and agents.workspace_id = new.workspace_id
        and agents.kind = 'website'
        and agents.surface = 'widget'
    ) then
    raise exception 'AGENT_WEBSITE_LIFECYCLE_UNAVAILABLE'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_website_agent_versions()
  from public, anon, authenticated, service_role;

drop trigger if exists agent_versions_protect_website_lifecycle
  on public.agent_versions;
create trigger agent_versions_protect_website_lifecycle
before insert or update on public.agent_versions
for each row execute function private.protect_website_agent_versions();

create or replace function private.can_view_agent(p_agent_id uuid)
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
      and (
        (agents.kind is null and agents.surface = 'widget')
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
        )
      )
  );
$$;

revoke all on function private.can_view_agent(uuid)
  from public, anon;
grant execute on function private.can_view_agent(uuid)
  to authenticated, service_role;

create or replace function private.can_edit_agent(p_agent_id uuid)
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
      and agents.archived_at is null
      and (
        (
          agents.kind is null
          and agents.surface = 'widget'
        )
        or (
          agents.kind = 'website'
          and workspaces.website_agents_enabled
        )
        or (
          agents.kind = 'automation'
          and workspaces.automations_enabled
        )
        or (
          agents.kind = 'assistant'
          and workspaces.internal_assistants_enabled
          and (
            agents.created_by = auth.uid()
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$$;

revoke all on function private.can_edit_agent(uuid)
  from public, anon;
grant execute on function private.can_edit_agent(uuid)
  to authenticated, service_role;

drop policy if exists "agents_member_update" on public.agents;
create policy "agents_member_update"
on public.agents for update
to authenticated
using (private.can_edit_agent(id))
with check (private.can_edit_agent(id));

drop policy if exists "agents_member_select" on public.agents;
create policy "agents_member_select"
on public.agents for select
to authenticated
using (private.can_view_agent(id));

drop policy if exists "agent_drafts_member_access"
  on public.agent_drafts;
drop policy if exists "agent_drafts_member_select"
  on public.agent_drafts;
create policy "agent_drafts_member_select"
on public.agent_drafts for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_drafts.agent_id
      and agents.workspace_id = agent_drafts.workspace_id
  )
);

drop policy if exists "agent_drafts_member_insert"
  on public.agent_drafts;
create policy "agent_drafts_member_insert"
on public.agent_drafts for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.agents
    where agents.id = agent_drafts.agent_id
      and agents.workspace_id = agent_drafts.workspace_id
  )
);

drop policy if exists "agent_drafts_member_update"
  on public.agent_drafts;
create policy "agent_drafts_member_update"
on public.agent_drafts for update
to authenticated
using (private.can_edit_agent(agent_id))
with check (
  private.can_edit_agent(agent_id)
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.agents
    where agents.id = agent_drafts.agent_id
      and agents.workspace_id = agent_drafts.workspace_id
  )
);

drop policy if exists "agent_drafts_member_delete"
  on public.agent_drafts;
create policy "agent_drafts_member_delete"
on public.agent_drafts for delete
to authenticated
using (private.can_edit_agent(agent_id));

drop policy if exists "agent_versions_member_select"
  on public.agent_versions;
create policy "agent_versions_member_select"
on public.agent_versions for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_versions.agent_id
      and agents.workspace_id = agent_versions.workspace_id
  )
);

drop policy if exists "agent_versions_member_insert"
  on public.agent_versions;
create policy "agent_versions_member_insert"
on public.agent_versions for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and published_by = (select auth.uid())
  and exists (
    select 1
    from public.agents
    where agents.id = agent_versions.agent_id
      and agents.workspace_id = agent_versions.workspace_id
  )
);

drop policy if exists "agent_connections_member_select"
  on public.agent_connections;
create policy "agent_connections_member_select"
on public.agent_connections for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.connections
      on connections.id = agent_connections.connection_id
    where agents.id = agent_connections.agent_id
      and agents.workspace_id = connections.workspace_id
  )
);

drop policy if exists "agent_connections_member_insert"
  on public.agent_connections;
create policy "agent_connections_member_insert"
on public.agent_connections for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.connections
      on connections.id = agent_connections.connection_id
    where agents.id = agent_connections.agent_id
      and agents.workspace_id = connections.workspace_id
  )
);

drop policy if exists "agent_connections_member_delete"
  on public.agent_connections;
create policy "agent_connections_member_delete"
on public.agent_connections for delete
to authenticated
using (private.can_edit_agent(agent_id));

drop policy if exists "agent_knowledge_sources_member_select"
  on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_select"
on public.agent_knowledge_sources for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.knowledge_sources
      on knowledge_sources.id =
        agent_knowledge_sources.knowledge_source_id
    where agents.id = agent_knowledge_sources.agent_id
      and agents.workspace_id = knowledge_sources.workspace_id
  )
);

drop policy if exists "agent_knowledge_sources_member_insert"
  on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_insert"
on public.agent_knowledge_sources for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.knowledge_sources
      on knowledge_sources.id =
        agent_knowledge_sources.knowledge_source_id
    where agents.id = agent_knowledge_sources.agent_id
      and agents.workspace_id = knowledge_sources.workspace_id
  )
);

drop policy if exists "agent_knowledge_sources_member_delete"
  on public.agent_knowledge_sources;
create policy "agent_knowledge_sources_member_delete"
on public.agent_knowledge_sources for delete
to authenticated
using (private.can_edit_agent(agent_id));

drop policy if exists "agent_knowledge_folders_member_select"
  on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_select"
on public.agent_knowledge_folders for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.knowledge_folders
      on knowledge_folders.id =
        agent_knowledge_folders.knowledge_folder_id
    where agents.id = agent_knowledge_folders.agent_id
      and agents.workspace_id = knowledge_folders.workspace_id
  )
);

drop policy if exists "agent_knowledge_folders_member_insert"
  on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_insert"
on public.agent_knowledge_folders for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    join public.knowledge_folders
      on knowledge_folders.id = knowledge_folder_id
    where agents.id = agent_id
      and agents.workspace_id = knowledge_folders.workspace_id
  )
);

drop policy if exists "agent_knowledge_folders_member_delete"
  on public.agent_knowledge_folders;
create policy "agent_knowledge_folders_member_delete"
on public.agent_knowledge_folders for delete
to authenticated
using (private.can_edit_agent(agent_id));

create or replace function public.validate_agent_automation_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.agents
    where agents.id = new.agent_id
      and agents.workspace_id = new.workspace_id
      and agents.kind = 'automation'
      and agents.surface = 'automation'
  ) then
    raise exception 'agent_automations.agent_id must reference a canonical Automation Agent in the same workspace';
  end if;

  if new.connection_id is not null and not exists (
    select 1
    from public.connections
    where connections.id = new.connection_id
      and connections.workspace_id = new.workspace_id
      and connections.toolkit_slug = 'gmail'
      and connections.status = 'connected'
  ) then
    raise exception 'agent_automations.connection_id must reference a connected Gmail account in the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists agent_automations_validate_integrity
  on public.agent_automations;
create trigger agent_automations_validate_integrity
before insert or update of workspace_id, agent_id, connection_id, provider, toolkit_slug, trigger_slug
on public.agent_automations
for each row execute function public.validate_agent_automation_integrity();

drop policy if exists "agent_automations_member_select"
  on public.agent_automations;
create policy "agent_automations_member_select"
on public.agent_automations for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
      and agents.kind = 'automation'
      and agents.surface = 'automation'
  )
);

drop policy if exists "automation_events_member_select"
  on public.automation_events;
create policy "automation_events_member_select"
on public.automation_events for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = automation_events.agent_id
      and agents.workspace_id = automation_events.workspace_id
      and agents.kind = 'automation'
      and agents.surface = 'automation'
  )
);

drop policy if exists "runs_member_access" on public.runs;
drop policy if exists "runs_member_select" on public.runs;
create policy "runs_member_select"
on public.runs for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = runs.agent_id
      and agents.workspace_id = runs.workspace_id
  )
);

drop policy if exists "run_steps_member_access" on public.run_steps;
drop policy if exists "run_steps_member_select" on public.run_steps;
create policy "run_steps_member_select"
on public.run_steps for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = run_steps.agent_id
      and agents.workspace_id = run_steps.workspace_id
  )
);

drop policy if exists "run_approvals_member_access"
  on public.run_approvals;
drop policy if exists "run_approvals_member_select"
  on public.run_approvals;
create policy "run_approvals_member_select"
on public.run_approvals for select
to authenticated
using (
  private.can_view_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = run_approvals.agent_id
      and agents.workspace_id = run_approvals.workspace_id
  )
);

drop policy if exists "agent_automations_member_insert"
  on public.agent_automations;
create policy "agent_automations_member_insert"
on public.agent_automations for insert
to authenticated
with check (
  private.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
      and agents.kind = 'automation'
      and agents.surface = 'automation'
  )
  and (
    connection_id is null
    or exists (
      select 1
      from public.connections
      where connections.id = connection_id
        and connections.workspace_id = agent_automations.workspace_id
        and connections.toolkit_slug = 'gmail'
        and connections.status = 'connected'
    )
  )
);

drop policy if exists "agent_automations_member_update"
  on public.agent_automations;
create policy "agent_automations_member_update"
on public.agent_automations for update
to authenticated
using (private.can_edit_agent(agent_id))
with check (
  private.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
      and agents.kind = 'automation'
      and agents.surface = 'automation'
  )
  and (
    connection_id is null
    or exists (
      select 1
      from public.connections
      where connections.id = connection_id
        and connections.workspace_id = agent_automations.workspace_id
        and connections.toolkit_slug = 'gmail'
        and connections.status = 'connected'
    )
  )
);

create or replace function private.validate_widget_agent_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_workspace_id uuid;
begin
  select widgets.workspace_id
  into resolved_workspace_id
  from public.widgets
  where widgets.id = new.widget_id;

  if resolved_workspace_id is null or not exists (
    select 1
    from public.agents
    where agents.id = new.agent_id
      and agents.workspace_id = resolved_workspace_id
      and agents.kind is null
      and agents.surface = 'widget'
  ) then
    raise exception 'widget_agents must reference a Widget and Agent in the same workspace'
      using errcode = '23514';
  end if;

  if new.published_version_id is not null and not exists (
    select 1
    from public.agent_versions
    where agent_versions.id = new.published_version_id
      and agent_versions.agent_id = new.agent_id
      and agent_versions.workspace_id = resolved_workspace_id
  ) then
    raise exception 'widget_agents published version must belong to its Agent'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_widget_agent_integrity()
  from public, anon, authenticated, service_role;

drop trigger if exists widget_agents_validate_integrity
  on public.widget_agents;
create trigger widget_agents_validate_integrity
before insert or update of widget_id, agent_id, published_version_id
on public.widget_agents
for each row execute function private.validate_widget_agent_integrity();
