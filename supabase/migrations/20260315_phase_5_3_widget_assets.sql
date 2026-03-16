insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'widget-assets',
  'widget-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "widget_assets_select" on storage.objects;
create policy "widget_assets_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'widget-assets'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);

drop policy if exists "widget_assets_insert" on storage.objects;
create policy "widget_assets_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'widget-assets'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);

drop policy if exists "widget_assets_update" on storage.objects;
create policy "widget_assets_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'widget-assets'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
)
with check (
  bucket_id = 'widget-assets'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);

drop policy if exists "widget_assets_delete" on storage.objects;
create policy "widget_assets_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'widget-assets'
  and public.is_workspace_member(nullif(split_part(name, '/', 1), '')::uuid)
);
