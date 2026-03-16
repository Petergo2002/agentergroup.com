alter table public.agents
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null;

alter table public.runs
  drop constraint if exists runs_status_check;

alter table public.runs
  add constraint runs_status_check
  check (status in ('queued', 'running', 'succeeded', 'failed', 'waiting_approval'));

create table if not exists public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  step_key text not null,
  step_type text not null,
  title text not null,
  detail text,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'succeeded', 'failed', 'skipped', 'waiting_approval')
  ),
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.run_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  step_id uuid references public.run_steps (id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'not_required')
  ),
  title text not null,
  detail text,
  requested_by uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  run_id uuid references public.runs (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists run_steps_run_id_idx on public.run_steps (run_id, created_at);
create index if not exists run_steps_workspace_id_idx on public.run_steps (workspace_id, created_at desc);
create index if not exists run_approvals_run_id_idx on public.run_approvals (run_id, created_at);
create index if not exists run_approvals_workspace_id_idx on public.run_approvals (workspace_id, created_at desc);
create index if not exists audit_logs_workspace_id_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists agents_archived_at_idx on public.agents (workspace_id, archived_at);

alter table public.run_steps enable row level security;
alter table public.run_approvals enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "run_steps_member_access" on public.run_steps;
create policy "run_steps_member_access"
on public.run_steps for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "run_approvals_member_access" on public.run_approvals;
create policy "run_approvals_member_access"
on public.run_approvals for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "audit_logs_member_access" on public.audit_logs;
create policy "audit_logs_member_access"
on public.audit_logs for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
