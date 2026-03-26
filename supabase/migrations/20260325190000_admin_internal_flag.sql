alter table if exists public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin
  is 'Internal admin flag — set manually in Supabase dashboard';
