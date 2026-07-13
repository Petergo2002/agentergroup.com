drop policy if exists "workspaces_owner_delete" on public.workspaces;
create policy "workspaces_owner_delete"
on public.workspaces for delete
using (owner_id = (select auth.uid()));
