-- Close the highest-impact direct Data API authorization gaps. Application
-- checks remain in place, but these invariants must also hold in Postgres
-- because authenticated users can call the Supabase API directly.

create schema if not exists private;
revoke all on schema private from public;

-- `profiles.is_admin` is authorization data. The self-update RLS policy only
-- limits which row a user can update, so remove broad table privileges and
-- allow only the columns used by the profile sync/settings flows.
revoke insert, update on table public.profiles from anon, authenticated;
grant insert (id, email, full_name, avatar_url)
  on table public.profiles to authenticated;
grant update (email, full_name, avatar_url)
  on table public.profiles to authenticated;

create or replace function private.protect_profile_admin_flag()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and coalesce(new.is_admin, false) then
      raise exception 'The internal admin flag cannot be set by this role.'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'The internal admin flag cannot be changed by this role.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_admin_flag()
  from public, anon, authenticated;

drop trigger if exists profiles_protect_admin_flag on public.profiles;
create trigger profiles_protect_admin_flag
before insert or update on public.profiles
for each row execute function private.protect_profile_admin_flag();

-- Agent editors may change product configuration, but they may not move an
-- agent to another tenant, replace its creator, change its identifier, or
-- convert an internal assistant into a less-restricted surface.
create or replace function private.protect_agent_identity_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.created_by is distinct from old.created_by then
      raise exception 'Agent identity and tenant fields are immutable.'
        using errcode = '42501';
    end if;

    if new.surface is distinct from old.surface
      and (old.surface = 'assistant' or new.surface = 'assistant') then
      raise exception 'Internal assistant surfaces cannot be converted.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_agent_identity_fields()
  from public, anon, authenticated;

drop trigger if exists agents_protect_identity_fields on public.agents;
create trigger agents_protect_identity_fields
before update on public.agents
for each row execute function private.protect_agent_identity_fields();

drop policy if exists "agents_member_update" on public.agents;
create policy "agents_member_update"
on public.agents for update
to authenticated
using (private.can_edit_agent(id))
with check (private.can_edit_agent(id));

-- A later permissive member-delete policy unintentionally broadened the
-- original owner-only policy. Keep permanent deletion owner-only and require
-- the archive step already enforced by the API.
drop policy if exists "agents_member_delete" on public.agents;
drop policy if exists "agents_owner_delete" on public.agents;
drop policy if exists "agents_delete_combined" on public.agents;
create policy "agents_owner_delete"
on public.agents for delete
to authenticated
using (
  archived_at is not null
  and exists (
    select 1
    from public.workspaces
    where workspaces.id = agents.workspace_id
      and workspaces.owner_id = (select auth.uid())
  )
);

-- Widget tenant identity and public access keys are not ordinary editable
-- appearance fields. Prevent authenticated Data API callers from moving a
-- widget between workspaces or replacing its stable public identifier.
create or replace function private.protect_widget_identity_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.widget_public_key is distinct from old.widget_public_key
      or new.created_at is distinct from old.created_at then
      raise exception 'Widget identity and tenant fields are immutable.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_widget_identity_fields()
  from public, anon, authenticated;

drop trigger if exists widgets_protect_identity_fields on public.widgets;
create trigger widgets_protect_identity_fields
before update on public.widgets
for each row execute function private.protect_widget_identity_fields();

-- Workspace and user identity are immutable on memberships. Until an
-- ownership-transfer transaction exists, the single owner membership cannot
-- be demoted, promoted, moved, or deleted through the Data API.
create or replace function private.protect_workspace_membership_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user::text in ('anon', 'authenticated') then
    if new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id then
      raise exception 'Workspace membership identity fields are immutable.'
        using errcode = '42501';
    end if;

    if new.role is distinct from old.role
      and (old.role = 'owner' or new.role = 'owner') then
      raise exception 'Workspace ownership requires an explicit transfer.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_workspace_membership_identity()
  from public, anon, authenticated;

drop trigger if exists workspace_members_protect_identity_fields
  on public.workspace_members;
create trigger workspace_members_protect_identity_fields
before update on public.workspace_members
for each row execute function private.protect_workspace_membership_identity();

drop policy if exists "workspace_members_admin_delete"
  on public.workspace_members;
revoke delete on table public.workspace_members from anon, authenticated;

-- The original bucket migration used generic policy names. The previous
-- hardening migration dropped different names, leaving anonymous reads active.
update storage.buckets
set public = false
where id = 'widget-attachments';

drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Admin Access" on storage.objects;
drop policy if exists "Public Access widget-attachments" on storage.objects;
