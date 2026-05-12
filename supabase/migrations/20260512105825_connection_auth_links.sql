create table if not exists public.connection_auth_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  toolkit_slug text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'revoked')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  completed_connection_id uuid references public.connections (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (token_hash),
  check (token_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists connection_auth_links_workspace_id_idx
  on public.connection_auth_links (workspace_id, created_at desc);

create index if not exists connection_auth_links_pending_token_hash_idx
  on public.connection_auth_links (token_hash)
  where status = 'pending';

create index if not exists connection_auth_links_pending_workspace_toolkit_idx
  on public.connection_auth_links (workspace_id, toolkit_slug, expires_at)
  where status = 'pending';

drop trigger if exists connection_auth_links_set_updated_at on public.connection_auth_links;
create trigger connection_auth_links_set_updated_at
before update on public.connection_auth_links
for each row execute procedure public.set_updated_at();

alter table public.connection_auth_links enable row level security;

drop policy if exists "connection_auth_links_admin_select" on public.connection_auth_links;
create policy "connection_auth_links_admin_select"
on public.connection_auth_links for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = connection_auth_links.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role in ('owner', 'admin')
  )
);

drop policy if exists "connection_auth_links_admin_insert" on public.connection_auth_links;
create policy "connection_auth_links_admin_insert"
on public.connection_auth_links for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = connection_auth_links.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role in ('owner', 'admin')
  )
);

drop policy if exists "connection_auth_links_admin_update" on public.connection_auth_links;
create policy "connection_auth_links_admin_update"
on public.connection_auth_links for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = connection_auth_links.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = connection_auth_links.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role in ('owner', 'admin')
  )
);

comment on table public.connection_auth_links
  is 'Bearer-secret Composio auth links that let an external person authorize one provider account into a workspace without Agentergroup access.';

comment on column public.connection_auth_links.token_hash
  is 'SHA-256 hash of the raw auth-link token. The raw token is only shown in the generated URL.';
