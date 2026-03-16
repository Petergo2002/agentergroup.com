alter table if exists public.widget_leads rename to legacy_widget_leads;
alter table if exists public.widget_session_messages rename to legacy_widget_session_messages;
alter table if exists public.widget_sessions rename to legacy_widget_sessions;
alter table if exists public.widget_deployments rename to legacy_widget_deployments;

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'deployed')),
  widget_public_key text not null unique default 'wgt_' || encode(gen_random_bytes(9), 'hex'),
  brand_name text not null,
  logo_url text,
  primary_color text not null default '#ff5c00',
  background_color text not null default '#0a0a0a',
  text_color text not null default '#f5f5f5',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  show_branding boolean not null default true,
  privacy_policy_url text,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deployed_at timestamptz,
  unique (workspace_id, slug)
);

create table if not exists public.widget_agents (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  published_version_id uuid references public.agent_versions (id) on delete set null,
  label text not null,
  description text not null default '',
  icon text,
  sort_order integer not null default 0,
  interaction_mode text not null default 'chat' check (interaction_mode in ('chat', 'contact_form')),
  greeting text not null default 'Hi! How can I help you today?',
  placeholder text not null default 'Write a message...',
  quick_actions jsonb not null default '[]'::jsonb,
  contact_form_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (widget_id, agent_id)
);

create table if not exists public.widget_sessions (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  session_id text not null,
  source text not null check (source in ('embedded', 'hosted', 'preview')),
  page_url text,
  referrer text,
  origin text,
  active_widget_agent_id uuid references public.widget_agents (id) on delete set null,
  active_agent_id uuid references public.agents (id) on delete set null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (widget_id, session_id)
);

create table if not exists public.widget_session_messages (
  id uuid primary key default gen_random_uuid(),
  widget_session_id uuid not null references public.widget_sessions (id) on delete cascade,
  widget_id uuid not null references public.widgets (id) on delete cascade,
  widget_agent_id uuid references public.widget_agents (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.widget_leads (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  widget_session_id uuid references public.widget_sessions (id) on delete set null,
  widget_agent_id uuid references public.widget_agents (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.widgets (
  id,
  workspace_id,
  name,
  slug,
  status,
  widget_public_key,
  brand_name,
  logo_url,
  primary_color,
  background_color,
  text_color,
  theme,
  show_branding,
  privacy_policy_url,
  allowed_origins,
  created_at,
  updated_at,
  deployed_at
)
select
  legacy.id,
  legacy.workspace_id,
  concat(coalesce(nullif(agent.name, ''), 'Agent'), ' Widget') as name,
  concat(coalesce(nullif(agent.slug, ''), 'widget'), '-widget') as slug,
  legacy.status,
  legacy.widget_public_key,
  legacy.brand_name,
  legacy.logo_url,
  legacy.primary_color,
  legacy.background_color,
  legacy.text_color,
  legacy.theme,
  legacy.show_branding,
  legacy.privacy_policy_url,
  legacy.allowed_origins,
  legacy.created_at,
  legacy.updated_at,
  legacy.deployed_at
from public.legacy_widget_deployments legacy
left join public.agents agent on agent.id = legacy.agent_id
on conflict (id) do nothing;

insert into public.widget_agents (
  id,
  widget_id,
  agent_id,
  published_version_id,
  label,
  description,
  icon,
  sort_order,
  interaction_mode,
  greeting,
  placeholder,
  quick_actions,
  contact_form_settings,
  created_at,
  updated_at
)
select
  legacy.id,
  legacy.id,
  legacy.agent_id,
  legacy.published_version_id,
  coalesce(nullif(agent.name, ''), 'Agent') as label,
  coalesce(agent.description, '') as description,
  null as icon,
  0 as sort_order,
  legacy.interaction_mode,
  legacy.greeting,
  legacy.placeholder,
  legacy.quick_actions,
  legacy.contact_form_settings,
  legacy.created_at,
  legacy.updated_at
from public.legacy_widget_deployments legacy
left join public.agents agent on agent.id = legacy.agent_id
on conflict (id) do nothing;

insert into public.widget_sessions (
  id,
  widget_id,
  session_id,
  source,
  page_url,
  referrer,
  origin,
  active_widget_agent_id,
  active_agent_id,
  first_seen_at,
  last_seen_at
)
select
  session.id,
  session.deployment_id,
  session.session_id,
  session.source,
  session.page_url,
  session.referrer,
  session.origin,
  session.deployment_id,
  deployment.agent_id,
  session.first_seen_at,
  session.last_seen_at
from public.legacy_widget_sessions session
join public.legacy_widget_deployments deployment on deployment.id = session.deployment_id
on conflict (id) do nothing;

insert into public.widget_session_messages (
  id,
  widget_session_id,
  widget_id,
  widget_agent_id,
  agent_id,
  role,
  content,
  metadata,
  created_at
)
select
  message.id,
  message.widget_session_id,
  message.deployment_id,
  message.deployment_id,
  deployment.agent_id,
  message.role,
  message.content,
  message.metadata,
  message.created_at
from public.legacy_widget_session_messages message
join public.legacy_widget_deployments deployment on deployment.id = message.deployment_id
on conflict (id) do nothing;

insert into public.widget_leads (
  id,
  widget_id,
  widget_session_id,
  widget_agent_id,
  agent_id,
  name,
  email,
  phone,
  message,
  created_at
)
select
  lead.id,
  lead.deployment_id,
  lead.widget_session_id,
  lead.deployment_id,
  deployment.agent_id,
  lead.name,
  lead.email,
  lead.phone,
  lead.message,
  lead.created_at
from public.legacy_widget_leads lead
join public.legacy_widget_deployments deployment on deployment.id = lead.deployment_id
on conflict (id) do nothing;

create index if not exists widgets_workspace_id_idx
  on public.widgets (workspace_id);
create index if not exists widgets_widget_public_key_idx
  on public.widgets (widget_public_key);
create index if not exists widget_agents_widget_id_idx
  on public.widget_agents (widget_id, sort_order);
create index if not exists widget_agents_agent_id_idx
  on public.widget_agents (agent_id);
create index if not exists widget_sessions_widget_id_idx
  on public.widget_sessions (widget_id, session_id);
create index if not exists widget_session_messages_session_id_idx
  on public.widget_session_messages (widget_session_id, created_at);
create index if not exists widget_leads_widget_id_idx
  on public.widget_leads (widget_id, created_at desc);

drop trigger if exists widgets_set_updated_at on public.widgets;
create trigger widgets_set_updated_at
before update on public.widgets
for each row execute procedure public.set_updated_at();

drop trigger if exists widget_agents_set_updated_at on public.widget_agents;
create trigger widget_agents_set_updated_at
before update on public.widget_agents
for each row execute procedure public.set_updated_at();

alter table public.widgets enable row level security;
alter table public.widget_agents enable row level security;
alter table public.widget_sessions enable row level security;
alter table public.widget_session_messages enable row level security;
alter table public.widget_leads enable row level security;

drop policy if exists "widgets_member_select" on public.widgets;
create policy "widgets_member_select"
on public.widgets for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "widgets_member_insert" on public.widgets;
create policy "widgets_member_insert"
on public.widgets for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists "widgets_member_update" on public.widgets;
create policy "widgets_member_update"
on public.widgets for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "widgets_member_delete" on public.widgets;
create policy "widgets_member_delete"
on public.widgets for delete
using (public.is_workspace_member(workspace_id));

drop policy if exists "widget_agents_member_select" on public.widget_agents;
create policy "widget_agents_member_select"
on public.widget_agents for select
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_agents.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_agents_member_insert" on public.widget_agents;
create policy "widget_agents_member_insert"
on public.widget_agents for insert
with check (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_agents.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_agents_member_update" on public.widget_agents;
create policy "widget_agents_member_update"
on public.widget_agents for update
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_agents.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_agents.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_agents_member_delete" on public.widget_agents;
create policy "widget_agents_member_delete"
on public.widget_agents for delete
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_agents.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_sessions_member_select" on public.widget_sessions;
create policy "widget_sessions_member_select"
on public.widget_sessions for select
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_sessions.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_session_messages_member_select" on public.widget_session_messages;
create policy "widget_session_messages_member_select"
on public.widget_session_messages for select
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_session_messages.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);

drop policy if exists "widget_leads_member_select" on public.widget_leads;
create policy "widget_leads_member_select"
on public.widget_leads for select
using (
  exists (
    select 1
    from public.widgets
    where widgets.id = widget_leads.widget_id
      and public.is_workspace_member(widgets.workspace_id)
  )
);
