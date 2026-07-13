-- This table is an internal webhook idempotency ledger. Browser roles have no
-- table grants; the explicit policy documents its service-only access model
-- and satisfies the RLS policy advisor without broadening client access.
drop policy if exists "stripe_webhook_events_service_role_all"
  on public.stripe_webhook_events;

create policy "stripe_webhook_events_service_role_all"
on public.stripe_webhook_events
for all
to service_role
using (true)
with check (true);
