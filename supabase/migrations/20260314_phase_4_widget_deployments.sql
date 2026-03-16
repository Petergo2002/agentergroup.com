create table if not exists public.widget_deployments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  published_version_id uuid references public.agent_versions (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'deployed')),
  widget_public_key text not null unique default 'wgt_' || encode(gen_random_bytes(9), 'hex'),
  brand_name text not null,
  logo_url text,
  primary_color text not null default '#ff5c00',
  background_color text not null default '#0a0a0a',
  text_color text not null default '#f5f5f5',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  greeting text not null default 'Hi! How can I help you today?',
  placeholder text not null default 'Write a message...',
  show_branding boolean not null default true,
  privacy_policy_url text,
  interaction_mode text not null default 'chat' check (interaction_mode in ('chat', 'contact_form')),
  allowed_origins text[] not null default '{}',
  quick_actions jsonb not null default '[]'::jsonb,
  contact_form_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deployed_at timestamptz,
  unique (agent_id)
);

create table if not exists public.widget_sessions (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.widget_deployments (id) on delete cascade,
  session_id text not null,
  source text not null check (source in ('embedded', 'hosted', 'preview')),
  page_url text,
  referrer text,
  origin text,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (deployment_id, session_id)
);

create table if not exists public.widget_session_messages (
  id uuid primary key default gen_random_uuid(),
  widget_session_id uuid not null references public.widget_sessions (id) on delete cascade,
  deployment_id uuid not null references public.widget_deployments (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.widget_leads (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.widget_deployments (id) on delete cascade,
  widget_session_id uuid references public.widget_sessions (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists widget_deployments_workspace_id_idx
  on public.widget_deployments (workspace_id);
create index if not exists widget_deployments_widget_public_key_idx
  on public.widget_deployments (widget_public_key);
create index if not exists widget_sessions_deployment_id_idx
  on public.widget_sessions (deployment_id, session_id);
create index if not exists widget_session_messages_session_id_idx
  on public.widget_session_messages (widget_session_id, created_at);
create index if not exists widget_leads_deployment_id_idx
  on public.widget_leads (deployment_id, created_at desc);

drop trigger if exists widget_deployments_set_updated_at on public.widget_deployments;
create trigger widget_deployments_set_updated_at
before update on public.widget_deployments
for each row execute procedure public.set_updated_at();

alter table public.widget_deployments enable row level security;
alter table public.widget_sessions enable row level security;
alter table public.widget_session_messages enable row level security;
alter table public.widget_leads enable row level security;

drop policy if exists "widget_deployments_member_select" on public.widget_deployments;
create policy "widget_deployments_member_select"
on public.widget_deployments for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "widget_deployments_member_insert" on public.widget_deployments;
create policy "widget_deployments_member_insert"
on public.widget_deployments for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists "widget_deployments_member_update" on public.widget_deployments;
create policy "widget_deployments_member_update"
on public.widget_deployments for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "widget_deployments_member_delete" on public.widget_deployments;
create policy "widget_deployments_member_delete"
on public.widget_deployments for delete
using (public.is_workspace_member(workspace_id));
