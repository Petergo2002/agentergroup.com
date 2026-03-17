drop policy if exists "widgets_member_delete" on public.widgets;
drop policy if exists "widgets_owner_delete" on public.widgets;

create policy "widgets_owner_delete"
on public.widgets for delete
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = widgets.workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
);
