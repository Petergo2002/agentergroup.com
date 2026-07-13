alter table if exists public.workspaces
  add column if not exists internal_assistants_enabled boolean not null default false;

comment on column public.workspaces.internal_assistants_enabled is
  'Workspace-level feature flag for internal assistants. Defaults to false and is only enabled from internal admin.';

create or replace function public.workspace_internal_assistants_enabled(
  target_workspace uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select workspaces.internal_assistants_enabled
      from public.workspaces
      where workspaces.id = target_workspace
    ),
    false
  );
$$;

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
    or public.workspace_internal_assistants_enabled(workspace_id)
  )
);
