alter table if exists public.agents
  drop constraint if exists agents_surface_check;

alter table if exists public.agents
  add constraint agents_surface_check
  check (surface in ('assistant', 'widget', 'automation'));

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
          agents.surface in ('widget', 'automation')
          and workspace_members.user_id is not null
        )
        or (
          agents.surface = 'assistant'
          and public.workspace_internal_assistants_enabled(agents.workspace_id)
          and workspace_members.user_id is not null
          and (
            agents.created_by = auth.uid()
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$$;

drop policy if exists "agents_member_insert" on public.agents;
create policy "agents_member_insert"
on public.agents for insert
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
  and (
    coalesce(surface, 'widget') = 'widget'
    or surface = 'automation'
    or (
      surface = 'assistant'
      and public.workspace_internal_assistants_enabled(workspace_id)
    )
  )
);

create table if not exists public.agent_automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  provider text not null default 'composio',
  toolkit_slug text not null default 'gmail',
  trigger_slug text not null default 'GMAIL_NEW_GMAIL_MESSAGE',
  trigger_config jsonb not null default '{}'::jsonb,
  composio_trigger_id text,
  status text not null default 'draft' check (status in ('draft', 'provisioning', 'active', 'paused', 'error')),
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agent_id),
  constraint agent_automations_provider_check check (provider = 'composio'),
  constraint agent_automations_toolkit_slug_check check (toolkit_slug = 'gmail'),
  constraint agent_automations_trigger_slug_check check (trigger_slug = 'GMAIL_NEW_GMAIL_MESSAGE')
);

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  automation_id uuid not null references public.agent_automations (id) on delete cascade,
  run_id uuid references public.runs (id) on delete set null,
  external_event_id text not null,
  trigger_slug text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (automation_id, external_event_id)
);

create index if not exists agent_automations_workspace_id_idx
  on public.agent_automations (workspace_id, updated_at desc);

drop index if exists agent_automations_composio_trigger_id_idx;
create unique index if not exists agent_automations_composio_trigger_id_idx
  on public.agent_automations (composio_trigger_id)
  where composio_trigger_id is not null;

create index if not exists automation_events_workspace_id_idx
  on public.automation_events (workspace_id, created_at desc);

create index if not exists automation_events_agent_id_idx
  on public.automation_events (agent_id, created_at desc);

drop trigger if exists agent_automations_set_updated_at on public.agent_automations;
create trigger agent_automations_set_updated_at
before update on public.agent_automations
for each row execute procedure public.set_updated_at();

drop trigger if exists automation_events_set_updated_at on public.automation_events;
create trigger automation_events_set_updated_at
before update on public.automation_events
for each row execute procedure public.set_updated_at();

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
      and agents.surface = 'automation'
  ) then
    raise exception 'agent_automations.agent_id must reference an automation agent in the same workspace';
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

drop trigger if exists agent_automations_validate_integrity on public.agent_automations;
create trigger agent_automations_validate_integrity
before insert or update of workspace_id, agent_id, connection_id, provider, toolkit_slug, trigger_slug
on public.agent_automations
for each row execute function public.validate_agent_automation_integrity();

alter table public.agent_automations enable row level security;
alter table public.automation_events enable row level security;

drop policy if exists "agent_automations_member_access" on public.agent_automations;
drop policy if exists "agent_automations_member_select" on public.agent_automations;
create policy "agent_automations_member_select"
on public.agent_automations for select
using (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
      and agents.surface = 'automation'
  )
);

drop policy if exists "agent_automations_member_insert" on public.agent_automations;
create policy "agent_automations_member_insert"
on public.agent_automations for insert
with check (
  public.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
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

drop policy if exists "agent_automations_member_update" on public.agent_automations;
create policy "agent_automations_member_update"
on public.agent_automations for update
using (public.can_edit_agent(agent_id))
with check (
  public.can_edit_agent(agent_id)
  and exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and agents.workspace_id = agent_automations.workspace_id
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

drop policy if exists "agent_automations_member_delete" on public.agent_automations;
create policy "agent_automations_member_delete"
on public.agent_automations for delete
using (public.can_edit_agent(agent_id));

drop policy if exists "automation_events_member_select" on public.automation_events;
create policy "automation_events_member_select"
on public.automation_events for select
using (public.is_workspace_member(workspace_id));
