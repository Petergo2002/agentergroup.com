-- Supabase may apply default table grants to new public tables. Keep this
-- evidence table narrower than those defaults: anonymous clients get nothing,
-- authenticated clients can only read rows allowed by the self-select RLS policy.

revoke all privileges on table public.user_legal_acceptances from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.user_legal_acceptances from authenticated;
grant select on table public.user_legal_acceptances to authenticated;
