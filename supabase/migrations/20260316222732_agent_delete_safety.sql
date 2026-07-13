drop policy if exists "agents_member_delete" on public.agents;
drop policy if exists "agents_owner_delete" on public.agents;

create policy "agents_owner_delete"
on public.agents for delete
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = agents.workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
);
