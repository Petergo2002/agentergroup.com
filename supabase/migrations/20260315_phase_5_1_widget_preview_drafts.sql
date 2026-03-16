create table if not exists public.widget_preview_drafts (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  revision text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists widget_preview_drafts_widget_revision_idx
  on public.widget_preview_drafts(widget_id, revision);

create index if not exists widget_preview_drafts_expires_at_idx
  on public.widget_preview_drafts(expires_at);

alter table public.widget_preview_drafts enable row level security;
