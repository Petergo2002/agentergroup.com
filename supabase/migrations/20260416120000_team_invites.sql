-- ============================================================================
-- Team Invites Migration
-- Apply through the ordered migration runner.
-- ============================================================================

-- 1. Create workspace_invites table
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  created_at timestamptz not null default timezone('utc', now())
);

-- 2. Prevent duplicate pending invites for the same email in the same workspace
create unique index if not exists workspace_invites_unique_pending
  on public.workspace_invites (workspace_id, email)
  where status = 'pending';

-- 3. Indexes for fast lookups
create index if not exists workspace_invites_token_idx
  on public.workspace_invites (token)
  where status = 'pending';

create index if not exists workspace_invites_email_idx
  on public.workspace_invites (email)
  where status = 'pending';

create index if not exists workspace_invites_workspace_id_idx
  on public.workspace_invites (workspace_id);

-- 4. Enable RLS
alter table public.workspace_invites enable row level security;

-- 5. RLS Policies

-- Members of the workspace can view invites
drop policy if exists "workspace_invites_member_select" on public.workspace_invites;
create policy "workspace_invites_member_select"
on public.workspace_invites for select
using (public.is_workspace_member(workspace_id));

-- Owner/admin can create invites
drop policy if exists "workspace_invites_admin_insert" on public.workspace_invites;
create policy "workspace_invites_admin_insert"
on public.workspace_invites for insert
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);

-- Owner/admin can update invites (e.g. revoke)
drop policy if exists "workspace_invites_admin_update" on public.workspace_invites;
create policy "workspace_invites_admin_update"
on public.workspace_invites for update
using (
  exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);

-- Owner/admin can delete invites
drop policy if exists "workspace_invites_admin_delete" on public.workspace_invites;
create policy "workspace_invites_admin_delete"
on public.workspace_invites for delete
using (
  exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);

-- 6. Allow the invite target to read their own invite by token (for the accept page)
-- This is needed because the accepting user is NOT yet a workspace member
drop policy if exists "workspace_invites_target_select" on public.workspace_invites;
create policy "workspace_invites_target_select"
on public.workspace_invites for select
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
);

-- 7. Add a profiles policy so workspace members can see each other's profiles
drop policy if exists "profiles_workspace_peer_select" on public.profiles;
create policy "profiles_workspace_peer_select"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members my_membership
    join public.workspace_members peer_membership
      on peer_membership.workspace_id = my_membership.workspace_id
    where my_membership.user_id = auth.uid()
      and peer_membership.user_id = profiles.id
  )
);

-- 8. Allow owner/admin to delete workspace members (for the remove member action)
drop policy if exists "workspace_members_admin_delete" on public.workspace_members;
create policy "workspace_members_admin_delete"
on public.workspace_members for delete
using (
  -- You can remove yourself (leave workspace)
  user_id = auth.uid()
  or
  -- Owner/admin can remove others
  exists (
    select 1 from public.workspace_members actor
    where actor.workspace_id = workspace_members.workspace_id
      and actor.user_id = auth.uid()
      and actor.role in ('owner', 'admin')
  )
);
