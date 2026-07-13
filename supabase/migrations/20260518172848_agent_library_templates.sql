create table if not exists public.agent_library_templates (
  id uuid primary key default gen_random_uuid(),
  source_agent_id uuid references public.agents (id) on delete set null,
  source_workspace_id uuid not null references public.workspaces (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  name text not null,
  slug text not null,
  description text not null default '',
  surface text not null default 'widget' check (surface in ('widget', 'assistant', 'automation')),
  model text not null,
  instructions text not null default '',
  starter_prompts text[] not null default '{}',
  timezone text not null default 'UTC',
  definition jsonb not null default '{}'::jsonb,
  required_integrations text[] not null default '{}',
  knowledge_source_count integer not null default 0 check (knowledge_source_count >= 0),
  rejection_reason text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agent_library_template_sources (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.agent_library_templates (id) on delete cascade,
  original_source_id uuid references public.knowledge_sources (id) on delete set null,
  original_source_type text not null,
  source_name text not null,
  source_description text not null default '',
  content_text text not null,
  mime_type text,
  file_size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists agent_library_templates_slug_key
  on public.agent_library_templates (slug);

create index if not exists agent_library_templates_status_created_idx
  on public.agent_library_templates (status, created_at desc);

create index if not exists agent_library_templates_submitter_idx
  on public.agent_library_templates (submitted_by, created_at desc);

create index if not exists agent_library_template_sources_template_idx
  on public.agent_library_template_sources (template_id);

drop trigger if exists agent_library_templates_set_updated_at on public.agent_library_templates;
create trigger agent_library_templates_set_updated_at
before update on public.agent_library_templates
for each row execute procedure public.set_updated_at();

alter table public.agent_library_templates enable row level security;
alter table public.agent_library_template_sources enable row level security;

drop policy if exists "agent_library_templates_member_select" on public.agent_library_templates;
create policy "agent_library_templates_member_select"
on public.agent_library_templates for select
to authenticated
using (
  status = 'approved'
  or submitted_by = (select auth.uid())
  or public.is_workspace_member(source_workspace_id)
);

drop policy if exists "agent_library_templates_member_insert" on public.agent_library_templates;
create policy "agent_library_templates_member_insert"
on public.agent_library_templates for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'pending'
  and public.is_workspace_member(source_workspace_id)
);

drop policy if exists "agent_library_template_sources_member_select" on public.agent_library_template_sources;
create policy "agent_library_template_sources_member_select"
on public.agent_library_template_sources for select
to authenticated
using (
  exists (
    select 1
    from public.agent_library_templates templates
    where templates.id = template_id
      and (
        templates.status = 'approved'
        or templates.submitted_by = (select auth.uid())
        or public.is_workspace_member(templates.source_workspace_id)
      )
  )
);

drop policy if exists "agent_library_template_sources_member_insert" on public.agent_library_template_sources;
create policy "agent_library_template_sources_member_insert"
on public.agent_library_template_sources for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_library_templates templates
    where templates.id = template_id
      and templates.status = 'pending'
      and templates.submitted_by = (select auth.uid())
      and public.is_workspace_member(templates.source_workspace_id)
  )
);
