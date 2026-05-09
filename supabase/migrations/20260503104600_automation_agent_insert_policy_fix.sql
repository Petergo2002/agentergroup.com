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

alter table if exists public.agent_automations
  drop constraint if exists agent_automations_status_check;

alter table if exists public.agent_automations
  add constraint agent_automations_status_check
  check (status in ('draft', 'provisioning', 'active', 'paused', 'error'));

alter table if exists public.agent_automations
  drop constraint if exists agent_automations_provider_check;

alter table if exists public.agent_automations
  add constraint agent_automations_provider_check
  check (provider = 'composio');

alter table if exists public.agent_automations
  drop constraint if exists agent_automations_toolkit_slug_check;

alter table if exists public.agent_automations
  add constraint agent_automations_toolkit_slug_check
  check (toolkit_slug = 'gmail');

alter table if exists public.agent_automations
  drop constraint if exists agent_automations_trigger_slug_check;

alter table if exists public.agent_automations
  add constraint agent_automations_trigger_slug_check
  check (trigger_slug = 'GMAIL_NEW_GMAIL_MESSAGE');

alter table if exists public.automation_events
  drop constraint if exists automation_events_status_check;

alter table if exists public.automation_events
  add constraint automation_events_status_check
  check (status in ('received', 'processing', 'processed', 'ignored', 'failed'));

drop index if exists agent_automations_composio_trigger_id_idx;
create unique index if not exists agent_automations_composio_trigger_id_idx
  on public.agent_automations (composio_trigger_id)
  where composio_trigger_id is not null;

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
