# Production Readiness And Manual Steps

Last updated: 2026-09-18

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

As of September 18, 2026, the repository contains 109 local migrations.
Recent hardening migrations applied and verified include:
- `20260918140000_thirty_day_trial_plan.sql`: Adds the `trial` plan tier and `workspace_subscriptions.trial_ends_at`, and teaches `increment_workspace_message_usage` to refuse messages once a trial expires. **Applied and verified in the linked project on 18 September 2026**, including a rolled-back transaction proving an expired trial is denied *without* its usage being reset.
- `20260918120000_reset_usage_on_billing_period_advance.sql`: Resets `messages_used` in the same statement that advances the Stripe billing period, guarded by `p_period_start > billing_cycle_start` so replays and same-period plan changes never reset twice. **Applied and verified in the linked project on 18 September 2026** — the deployed function carries the reset, remains `security invoker`, and is executable only by `service_role`.
- `20260910140100_transactional_agent_save_publish.sql`: Folds agent save and publish into atomic PostgreSQL transactions (`save_agent_v1` and `publish_agent_v1`) with optimistic concurrency locks.
- `20260911160000_dashboard_analytics_totals_rpc.sql`: SQL aggregate RPC `public.dashboard_conversation_analytics_totals` for analytics totals.
- `20260911170000_widget_proactive_message.sql`: Proactive teasers and visitor messaging.
- `20260911180000_optimize_widget_session_summary_triggers.sql`: High-speed trigger fast-paths on `widget_sessions` (no-op on turn-locks, indexed ~0.1ms heartbeat updates, and fast `pg_cron` inactivity sweep updates).

Before any future database change, verify that the complete local and linked histories still match:

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
- a renewal that advances the period resets `messages_used`, and a replayed or
  same-period event does not reset it again
- an expired trial is refused messages and its usage is NOT reset (the cycle
  reset must never run for `plan_tier = 'trial'`, or the trial renews itself)
- `provision_workspace_milo_v1` is executable only by `service_role`
- Milo primary-resource validation and protection triggers are active
- ambiguous legacy multi-agent workspaces remain classic and unchanged

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
public dashboard/widget origins (`NEXT_PUBLIC_APP_URL=https://avenro.se`,
`NEXT_PUBLIC_WIDGET_APP_URL=https://widget.avenro.se`, and `EMAIL_FROM_ADDRESS="Agentergroup <noreply@avenro.se>"`).
For DNS, Vercel, and Resend setup, see [`avenro-domain-setup.md`](./avenro-domain-setup.md).

Set `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED=false` only when intentionally restoring classic UI. The default Milo experience is enabled when the variable is absent or not `false`.

## Release Gate

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run widget:build
npm audit --audit-level=moderate
npm --prefix apps/widget-v2 audit --audit-level=moderate
```

`npm run widget:build` runs the widget application and Vite configuration type
checks before bundling. Use `npm run widget:typecheck` to run those checks alone.
CI also checks both packages for dependency advisories at moderate severity or
higher. Root lint excludes the separate local workspaces under `.gemini/`.

The `eslint-plugin-react-hooks` override retains version `7.0.1`: version
`7.1.1` reports 39 errors in existing components that pass the previous version.
Review those diagnostics in a separate React cleanup before removing the pin;
the September 9, 2026 dependency maintenance keeps application behavior intact.

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
6. Deploy the dashboard and widget runtime together (configured for `https://avenro.se` and `https://widget.avenro.se`; follow [`avenro-domain-setup.md`](./avenro-domain-setup.md)).
7. Verify `/api/health`, authentication, assistant privacy, upload, retention,
   checkout, webhook replay, cancellation, renewal, and unknown-price handling.
8. Verify the Composio webhook subscription includes `composio.trigger.message`,
   `composio.connected_account.expired`, and `composio.trigger.disabled`; test one
   Gmail automation event through Activity and Analytics.
9. Confirm the intended Auth password policy. Leaked-password protection is
   currently intentionally disabled and is not a release blocker.
10. Review `stripe_webhook_events` for `failed` or `requires_review` rows.
11. Verify `/milo` and `/website-chat` resolve only the active workspace's primary IDs.
12. Verify Website Chat remains full-screen across loading, repair, and editing and that Back returns to `/dashboard`.
13. Verify the Milo dashboard prioritizes Leads, Improve Milo, Connections, and Knowledge.
14. Monitor logs and storage growth during the first customer rollout.

## Beta / Test User Readiness Status

**Current Status (September 18, 2026): READY FOR TEST USERS / PRIVATE BETA**

The platform has passed all pre-launch verification gates:
- **Build & Quality:** 0 TypeScript errors (`npm run typecheck`), 0 ESLint warnings (`npm run lint`), **424/424 automated tests passing** (`npm test`), 0 Widget V2 typecheck errors (`npm run widget:typecheck`), and clean Next.js 16.3.4 Turbopack production build (`npm run build`).
- **Cryptographic API Auth Hardening:** Route authentication across the 9 high-frequency mutation and chat endpoints uses `getVerifiedApiIdentity()` (`src/lib/app/api-auth.ts`). This verifies the token's cryptographic ES256 signature locally via `supabase.auth.getClaims()` rather than trusting unverified cookie fields, preventing spoofing while eliminating redundant auth server round trips (~40–80ms saved per turn). Tested in `tests/security/api-route-identity-verification.test.ts`.
- **Transactional Integrity:** Agent draft save and version publishing run as single PostgreSQL transactions (`save_agent_v1` and `publish_agent_v1`) with optimistic concurrency row-locking.
- **Widget V2 & Database Stability:** Database trigger amplification on `widget_sessions` was resolved via fast-paths (turn-lock no-ops, ~0.1ms heartbeat updates, and fast `pg_cron` inactivity sweep status updates). Lead AI conversation summaries dynamically refresh on new visitor messages and return cached summaries with zero model spend when transcripts are unchanged.
- **Latency & Concurrency:** Widget loading queries run in parallel with context-threaded branding entitlements (eliminating duplicate `workspace_subscriptions` queries), and independent loader queries execute concurrently with `Promise.all`.
- **Silent-Failure Hardening (18 September 2026):** Every tool call a turn requests now executes (the Composio SDK helper ran only the first, which also dropped the primary-calendar mirror of every booking); an interrupted model stream is no longer persisted as a completed answer; a Stripe renewal resets the message allowance; raw debug traces no longer persist on the public widget path; revoked members lose cached access immediately on the handling instance. Document (PDF/text) uploads are gated off behind `WIDGET_DOCUMENT_UPLOAD_ENABLED` — image uploads are unaffected. See [Pre-Launch Hardening 2026-09-18](../roadmap/pre-launch-hardening-2026-09-18.md).
- **Billing Strategy for Test Users:** Self-serve Stripe billing is not required for the initial private beta. Pilot users can be onboarded on the starter plan or granted managed pilot access using the built-in manual plan activation flow (see `docs/guides/manual-plan-activation.md`).

## Known Open Findings (carried forward from archived audits)

Three findings carried forward from the 5 September 2026 project audit, plus
four left deliberately open by the [18 September 2026 pre-launch
round](../roadmap/pre-launch-hardening-2026-09-18.md). None is a private-beta
blocker; all matter before unsupervised, high-volume use.

| Finding | Current behaviour | Why it still matters |
| --- | --- | --- |
| **Knowledge outages degrade grounding silently** | When `search-knowledge` times out or errors, the failure is logged and the turn continues with no retrieved Knowledge and no structured outage signal in the model context (`src/lib/runtime/agent-chat.ts:1001`). | A visitor can receive a confident, normal-looking answer composed without the business information that should have grounded it. The default Milo instructions discourage invention, but nothing distinguishes "no matching answer" from "Knowledge was unavailable". Fix by propagating a typed retrieval outcome and surfacing an operator-visible signal. |
| **Automation events can stick in `processing`** | The executor claims an event by setting `status = 'processing'` (`src/lib/automation/executor.ts:62`). A process termination after the claim leaves it claimed forever; duplicate deliveries only requeue events still in `received`. The leased outbox in migration `20260725221400` covers provider trigger cleanup, not this executor claim. | Automation is deliberately outside the initial Milo pilot, which contains the exposure. Add durable leases, reclaim, dead-letter visibility and action idempotency before automation is offered for time-sensitive business operations. |
| **No per-turn cost accounting** | The OpenRouter wrapper sets no explicit output-token limit and no provider `usage` is accumulated into a per-turn record (`src/lib/openrouter.ts`). | Message credits cap the *number* of turns, not their size, so turns on different models are not comparable in cost. Capture usage per completion (including recovery attempts), tag it by workspace and model, and report estimated cost per conversation before changing default models or opening self-serve volume. |
| **Self-serve checkout can create a second subscription** | `/api/billing/checkout` calls Stripe with `mode: 'subscription'` and rejects only an identical plan; it never checks the existing `stripe_subscription_id`. Unreachable while `NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED` is false. | A Starter customer upgrading to Premium could hold both recurring subscriptions. **Must be fixed before self-serve billing is enabled**, and any pre-existing duplicates reconciled. |
| **No durable idempotency for external writes** | `withToolExecutionTimeout` stops waiting but cannot cancel — the provider SDK takes no abort signal. The tool message now tells the model the outcome is unconfirmed and not to repeat the action, but no operation ledger or idempotency key exists. | A timed-out booking or email may have succeeded. At pilot volume a daily calendar check is the proportionate control; a durable ledger with reconciliation is required before unattended booking. |
| **Lead-notification failures are silent** | `deliver()` returns `success: false` rather than throwing, and the lead route discards the result, so the surrounding `catch` never sees a normal delivery failure. Automatic chat lead capture does not send this notification at all. | The lead is still saved, so **the dashboard is the source of truth, not the email**. Do not promise universal email alerts. Add delivery state and retry. |
| **Revocation is stale across instances for up to 30s** | `DELETE .../members/[memberId]` now invalidates the cached workspace context, but `workspaceContextCache` is process-local, so other warm instances can still serve stale membership for the remainder of the 30s TTL — and service-role reads such as lead listing trust that context. | Narrowed, not closed. Closing it means not caching authorization for service-role-backed reads. Test revocation across warm instances before granting untrusted members access. |

Full reasoning and original evidence: [archived project audit](../archive/project-audit-2026-09-05.md).

## Future Scale Roadmap (Post-Beta)

These items are targeted for unrestricted, high-volume self-serve scale and are not blockers for pilot customers or test users:

- **Workspace Bootstrap RPC (Audit A3):** Collapse the 3 serial DB round trips in `src/lib/app/bootstrap.ts` into a single PostgreSQL RPC to optimize cold starts.
- **Admin Overview Aggregation:** Admin overview queries still aggregate broad result sets in application code. Move them to reviewed SQL aggregates before unrestricted self-service scale.
- **Shared Supabase Client Types:** The committed `src/lib/supabase/database.types.ts` matches production; full global generic parameterization across all domain models remains an ongoing DX cleanup.
- **Global Origin Guard:** Mutation routes currently rely on Supabase cookie/session security and SameSite browser isolation; an application-wide Origin header check can be added after cataloging non-browser webhooks.
