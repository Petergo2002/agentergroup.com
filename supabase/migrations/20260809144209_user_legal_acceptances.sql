-- Immutable, versioned evidence that an authenticated user accepted the legal
-- documents presented during account creation.

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  acceptance_method text not null
    check (acceptance_method in ('email_signup', 'google_oauth')),
  recorded_at timestamptz not null default timezone('utc', now()),
  constraint user_legal_acceptances_version_unique
    unique (user_id, terms_version, privacy_version)
);

create index if not exists user_legal_acceptances_user_accepted_idx
  on public.user_legal_acceptances (user_id, accepted_at desc);

alter table public.user_legal_acceptances enable row level security;

drop policy if exists user_legal_acceptances_select_self
  on public.user_legal_acceptances;
create policy user_legal_acceptances_select_self
  on public.user_legal_acceptances
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Writes are server-only. Browser clients may read their own acceptance history,
-- but cannot forge or alter evidence by inserting arbitrary versions or dates.
revoke insert, update, delete, truncate on table public.user_legal_acceptances
  from anon, authenticated;
grant select on table public.user_legal_acceptances to authenticated;

comment on table public.user_legal_acceptances is
  'Immutable versioned records of Terms of Service acceptance and Privacy Policy acknowledgement.';
