drop policy if exists "workspace_members_member_select" on public.workspace_members;
create policy "workspace_members_member_select"
on public.workspace_members for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = auth.uid()
  )
  or public.is_workspace_member(workspace_id)
);
