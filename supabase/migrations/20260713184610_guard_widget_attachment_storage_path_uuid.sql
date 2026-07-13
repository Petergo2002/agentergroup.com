-- Storage object names are service-generated as <workspace-uuid>/<session>/...
-- but RLS expressions must remain safe for every row in storage.objects. Guard
-- the cast so a malformed first path segment cannot raise an invalid-text UUID
-- error while an authenticated user lists objects.
drop policy if exists "Workspace Member Access widget-attachments"
  on storage.objects;

create policy "Workspace Member Access widget-attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'widget-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.is_workspace_member(
    split_part(name, '/', 1)::uuid
  )
);
