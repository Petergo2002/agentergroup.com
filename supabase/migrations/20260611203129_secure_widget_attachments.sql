create table if not exists public.widget_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_id uuid not null references public.widgets (id) on delete cascade,
  widget_session_id uuid not null references public.widget_sessions (id) on delete cascade,
  storage_bucket text not null default 'widget-attachments'
    check (storage_bucket = 'widget-attachments'),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (
    mime_type in (
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain'
    )
  ),
  file_size_bytes bigint not null check (
    file_size_bytes > 0
    and file_size_bytes <= 5242880
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists widget_attachments_session_created_idx
  on public.widget_attachments (widget_session_id, created_at);

create index if not exists widget_attachments_workspace_created_idx
  on public.widget_attachments (workspace_id, created_at desc);

alter table public.widget_attachments enable row level security;

drop policy if exists "widget_attachments_member_select" on public.widget_attachments;
create policy "widget_attachments_member_select"
on public.widget_attachments for select
to authenticated
using (private.is_workspace_member(workspace_id));

revoke all on table public.widget_attachments from anon;
revoke insert, update, delete on table public.widget_attachments from authenticated;
grant select on table public.widget_attachments to authenticated;
grant all on table public.widget_attachments to service_role;

create or replace function private.enforce_widget_attachment_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  attachment_count integer;
  attachment_bytes bigint;
begin
  if not exists (
    select 1
    from public.widget_sessions
    join public.widgets
      on widgets.id = widget_sessions.widget_id
    where widget_sessions.id = new.widget_session_id
      and widget_sessions.widget_id = new.widget_id
      and widgets.workspace_id = new.workspace_id
  ) then
    raise exception 'Widget attachment scope is invalid.'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.widget_session_id::text, 0)
  );

  select
    count(*),
    coalesce(sum(file_size_bytes), 0)
  into attachment_count, attachment_bytes
  from public.widget_attachments
  where widget_session_id = new.widget_session_id;

  if attachment_count >= 10 then
    raise exception 'WIDGET_ATTACHMENT_COUNT_LIMIT_EXCEEDED'
      using errcode = 'P0001';
  end if;

  if attachment_bytes + new.file_size_bytes > 20971520 then
    raise exception 'WIDGET_ATTACHMENT_BYTES_LIMIT_EXCEEDED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_widget_attachment_quota
on public.widget_attachments;
create trigger enforce_widget_attachment_quota
before insert on public.widget_attachments
for each row
execute function private.enforce_widget_attachment_quota();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'widget-attachments',
  'widget-attachments',
  false,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public Access widget-attachments" on storage.objects;
drop policy if exists "Admin Access widget-attachments" on storage.objects;
drop policy if exists "Workspace Member Access widget-attachments" on storage.objects;

create policy "Admin Access widget-attachments"
on storage.objects for all
to service_role
using (bucket_id = 'widget-attachments')
with check (bucket_id = 'widget-attachments');

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
