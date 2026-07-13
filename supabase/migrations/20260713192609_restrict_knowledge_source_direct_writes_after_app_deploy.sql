-- Contract migration: apply only after the application release that routes
-- knowledge-source creates and updates through authenticated server endpoints
-- and service-only RPCs. Keeping this separate from the RPC creation migration
-- permits an expand/deploy/contract rollout without a write outage.

-- Knowledge source writes carry quota, tenant, storage-path, and processing
-- invariants. Keep reads/deletes under RLS, but do not permit authenticated
-- clients to bypass the server-side validation and quota reservation paths.
revoke insert, update on table public.knowledge_sources
  from anon, authenticated;
