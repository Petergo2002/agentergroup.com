insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'widget-attachments',
  'widget-attachments',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'widget-attachments' );

create policy "Admin Access"
on storage.objects for all
to service_role
using ( bucket_id = 'widget-attachments' );
