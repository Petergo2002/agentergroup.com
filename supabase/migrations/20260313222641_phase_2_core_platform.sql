create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members members
    where members.workspace_id = target_workspace
      and members.user_id = auth.uid()
  );
$$;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  model text not null default 'openai/gpt-4o-mini',
  instructions text not null default '',
  starter_prompts text[] not null default '{}',
  published_version_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, slug)
);

create table if not exists public.agent_drafts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references public.agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  definition jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null,
  definition jsonb not null default '{}'::jsonb,
  published_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (agent_id, version)
);

alter table public.agents
  add constraint agents_published_version_id_fkey
  foreign key (published_version_id) references public.agent_versions (id)
  on delete set null;

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'composio',
  toolkit_slug text not null,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected')),
  external_id text,
  account_label text not null default 'default',
  toolkit_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id) on delete cascade,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, toolkit_slug, account_label)
);

create table if not exists public.agent_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (agent_id, connection_id)
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  title text not null default 'New chat',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  thread_id uuid references public.chat_threads (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists agents_workspace_id_idx on public.agents (workspace_id);
create index if not exists agent_drafts_workspace_id_idx on public.agent_drafts (workspace_id);
create index if not exists agent_versions_workspace_id_idx on public.agent_versions (workspace_id);
create index if not exists connections_workspace_id_idx on public.connections (workspace_id);
create index if not exists chat_threads_workspace_id_idx on public.chat_threads (workspace_id);
create index if not exists messages_thread_id_idx on public.messages (thread_id, created_at);
create index if not exists runs_agent_id_idx on public.runs (agent_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute procedure public.set_updated_at();

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
before update on public.agents
for each row execute procedure public.set_updated_at();

drop trigger if exists agent_drafts_set_updated_at on public.agent_drafts;
create trigger agent_drafts_set_updated_at
before update on public.agent_drafts
for each row execute procedure public.set_updated_at();

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
before update on public.connections
for each row execute procedure public.set_updated_at();

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_drafts enable row level security;
alter table public.agent_versions enable row level security;
alter table public.connections enable row level security;
alter table public.agent_connections enable row level security;
alter table public.chat_threads enable row level security;
alter table public.messages enable row level security;
alter table public.runs enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces_member_select" on public.workspaces;
create policy "workspaces_member_select"
on public.workspaces for select
using (public.is_workspace_member(id));

drop policy if exists "workspaces_owner_insert" on public.workspaces;
create policy "workspaces_owner_insert"
on public.workspaces for insert
with check (owner_id = auth.uid());

drop policy if exists "workspaces_owner_update" on public.workspaces;
create policy "workspaces_owner_update"
on public.workspaces for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "workspace_members_member_select" on public.workspace_members;
create policy "workspace_members_member_select"
on public.workspace_members for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_self_insert" on public.workspace_members;
create policy "workspace_members_self_insert"
on public.workspace_members for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = auth.uid()
  )
);

drop policy if exists "workspace_members_owner_update" on public.workspace_members;
create policy "workspace_members_owner_update"
on public.workspace_members for update
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_id
      and workspaces.owner_id = auth.uid()
  )
);

drop policy if exists "agents_member_select" on public.agents;
create policy "agents_member_select"
on public.agents for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "agents_member_insert" on public.agents;
create policy "agents_member_insert"
on public.agents for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "agents_member_update" on public.agents;
create policy "agents_member_update"
on public.agents for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "agents_member_delete" on public.agents;
create policy "agents_member_delete"
on public.agents for delete
using (public.is_workspace_member(workspace_id));

drop policy if exists "agent_drafts_member_access" on public.agent_drafts;
create policy "agent_drafts_member_access"
on public.agent_drafts for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and updated_by = auth.uid());

drop policy if exists "agent_versions_member_select" on public.agent_versions;
create policy "agent_versions_member_select"
on public.agent_versions for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "agent_versions_member_insert" on public.agent_versions;
create policy "agent_versions_member_insert"
on public.agent_versions for insert
with check (public.is_workspace_member(workspace_id) and published_by = auth.uid());

drop policy if exists "connections_member_access" on public.connections;
create policy "connections_member_access"
on public.connections for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "agent_connections_member_select" on public.agent_connections;
create policy "agent_connections_member_select"
on public.agent_connections for select
using (
  exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and public.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_connections_member_insert" on public.agent_connections;
create policy "agent_connections_member_insert"
on public.agent_connections for insert
with check (
  exists (
    select 1
    from public.agents
    join public.connections on connections.id = connection_id
    where agents.id = agent_id
      and agents.workspace_id = connections.workspace_id
      and public.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "agent_connections_member_delete" on public.agent_connections;
create policy "agent_connections_member_delete"
on public.agent_connections for delete
using (
  exists (
    select 1
    from public.agents
    where agents.id = agent_id
      and public.is_workspace_member(agents.workspace_id)
  )
);

drop policy if exists "chat_threads_member_access" on public.chat_threads;
create policy "chat_threads_member_access"
on public.chat_threads for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "messages_member_access" on public.messages;
create policy "messages_member_access"
on public.messages for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "runs_member_access" on public.runs;
create policy "runs_member_access"
on public.runs for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
