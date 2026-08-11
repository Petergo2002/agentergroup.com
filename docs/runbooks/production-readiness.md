# Production Readiness And Manual Steps

Last updated: 2026-08-08

This document covers the launch-hardening changes that require coordinated
database, Edge Function, dashboard, and widget deployment. It is not evidence
that production is ready until the checks below have been completed in a
non-production project and then repeated in production.

## Security Model

- Workspace data is tenant-scoped through Supabase RLS and
  `private.is_workspace_member(workspace_id)`.
- Assistant and preview `chat_threads` are user-owned. `created_by` must match
  `auth.uid()` for authenticated access.
- Authenticated members may read permitted runtime history, but `audit_logs`,
  `runs`, `run_steps`, and `messages` are written through trusted server paths.
- Public widget routes use an admin client only after widget access, origin,
  session, input, rate-limit, and attachment ownership checks.
- `process-knowledge-source` authorizes user calls with a user-scoped Supabase
  client before any service-role mutation.

Service-role and secret keys must remain server-only. Never expose them through
`NEXT_PUBLIC_*`, widget configuration, logs, or client responses.

## Migration Status

As of August 8, 2026, all 93 local migration versions and names exactly match
the linked production history. The audit did not identify a schema migration
that needed to be applied. Before any future database change, verify that this
remains true:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Resolve any migration-history drift before `supabase db push --linked`. Do not
mark local migrations as applied unless their SQL is already present and
verified in production.

After any future migration, verify:

- authenticated users cannot insert, update, or delete `audit_logs`, `runs`,
  `run_steps`, or `messages`
- assistant users cannot read or rename another user's thread
- `widget-attachments` is private and rejects SVG
- `widget_attachments` quota and scope triggers are active
- `stripe_webhook_events` is service-role only
- subscription events with older Stripe timestamps cannot overwrite newer state

## Edge Function Deployment

Deploy the updated knowledge processor after the database quota RPC exists:

```bash
supabase functions deploy process-knowledge-source --no-verify-jwt
```

The function performs its own authentication because it accepts both
user-scoped JWT calls and trusted internal calls. Confirm the project has the
Supabase publishable key, a server secret key, and `FIRECRAWL_API_KEY` configured
as function secrets. Do not print their values during verification.

Production version 13 was deployed and source-compared on August 8, 2026. Its
entrypoint and both shared dependencies matched the repository exactly after
deployment.

## Widget Attachment Rollout

New uploads:

- are limited to 5 MB each, 10 files and 20 MB per session
- accept PNG, JPEG, WebP, GIF, PDF, and UTF-8 plain text
- reject SVG and MIME/extension mismatches
- use server-issued attachment UUIDs and private signed URLs
- are deleted from Storage before retention, DSAR, or widget deletion removes
  their database/session rows

Changing the existing bucket to private can make legacy public attachment URLs
unavailable. Legacy objects may not have a `widget_attachments` metadata row or
the new workspace-prefixed path. Inventory these objects before migration and
choose either a reviewed backfill or a retention-approved deletion. Do not
delete legacy objects without owner approval.

Deploy `apps/widget-v2` with the dashboard release because the attachment
response and chat request now include the server-issued `id`.

## Stripe Requirements

Configure the Stripe endpoint for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Set `STRIPE_WEBHOOK_SECRET` for the exact deployed endpoint. Keep the configured
Starter/Premium price IDs unchanged unless the Stripe dashboard and application
mapping are updated together.

Verification:

1. Create checkout twice for one workspace and confirm the same customer ID is
   reused.
2. Replay one Stripe event and confirm the ledger returns it as a duplicate.
3. Send active, past-due, canceled, and renewed subscription fixtures.
4. Send an unknown price fixture and confirm it becomes `requires_review`
   without changing the workspace plan.
5. Confirm older events cannot overwrite a newer subscription state.

## Environment And Local Setup

Use `.env.example` and `apps/widget-v2/.env.example` as the variable inventory.
Minimum local setup:

```bash
npm install
npm --prefix apps/widget-v2 install
supabase start
supabase db reset
```

Required production categories include Supabase URL/publishable/server keys,
Stripe secret/webhook/price IDs, OpenRouter, `RATE_LIMIT_SECRET`,
`WIDGET_ACCESS_SECRET`, Firecrawl for website knowledge, and the configured
public dashboard/widget origins.

## Release Gate

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run widget:build
npm audit --audit-level=moderate
npm --prefix apps/widget-v2 audit --audit-level=moderate
```

The source-level security tests do not replace live RLS integration tests.
Before self-service launch, run a local or staging test with two real Supabase
users in different workspaces and verify cross-tenant knowledge, threads,
messages, audit records, and attachments are inaccessible.

The root app must remain on React/React DOM `19.2.4` or a later reviewed patch.
Version `19.2.3` has incomplete React Server Components security fixes.

## Deployment Checklist

1. Confirm a current Supabase backup and tested restore path.
2. Confirm linked migration history still matches the repository.
3. Deploy approved database or Edge Function changes in staging before production.
4. Resolve the legacy widget attachment decision.
5. Apply only reviewed, pending production migrations.
6. Deploy the dashboard and widget runtime together.
7. Verify `/api/health`, authentication, assistant privacy, upload, retention,
   checkout, webhook replay, cancellation, renewal, and unknown-price handling.
8. Verify the Composio webhook subscription includes `composio.trigger.message`,
   `composio.connected_account.expired`, and `composio.trigger.disabled`; test one
   Gmail automation event through Activity and Analytics.
9. Confirm the intended Auth password policy. Leaked-password protection is
   currently intentionally disabled and is not a release blocker.
10. Review `stripe_webhook_events` for `failed` or `requires_review` rows.
11. Monitor logs and storage growth during the first customer rollout.

## Known Remaining Work

- Full builder save is not one database transaction. Connection replacement is
  atomic, but draft, knowledge, automation, and connection updates can still
  partially succeed across separate requests.
- Admin overview queries still aggregate broad result sets in application code.
  Move them to reviewed SQL aggregates before unrestricted self-service scale.
- The committed `src/lib/supabase/database.types.ts` matches production, but
  shared Supabase clients are not yet globally parameterized. Existing domain
  models need reviewed JSON and enum adapters before that can be enabled
  without broad casts.
- Protected mutation routes rely on the Supabase cookie/session model and
  SameSite behavior rather than a single application-wide Origin/CSRF guard.
  Introducing a global guard needs an inventory of non-browser callers and
  explicit production-behavior approval.
