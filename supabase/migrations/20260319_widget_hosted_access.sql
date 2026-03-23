alter table public.widgets
  add column if not exists hosted_enabled boolean not null default true;
