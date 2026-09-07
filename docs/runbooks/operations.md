# Agentergroup Operations Runbook

Last updated: 2026-09-07

## Purpose

This runbook captures the minimum operational checks for release readiness, health checks, backup/restore confidence, and the separate widget runtime deployment path.

## Local Release Gate

Run these checks before shipping application changes:

```bash
npm run lint
npm test
npm run build
npm run widget:build
```

Run `npm --prefix apps/widget-v2 ci` before the gate in clean CI or on a fresh checkout.

When a release includes Supabase migrations, apply and verify them before deploying code that
depends on the new schema. The widget session-knowledge change requires
`20260531160122_folder_sources_in_widget_session_search.sql`.

For the June production-hardening migration order, private attachment rollout,
Stripe verification, and production drift checks, use
[`production-readiness.md`](./production-readiness.md).

For a Milo release, also read [`../guides/milo-experience.md`](../guides/milo-experience.md). The required schema change is `20260811221031_milo_primary_workspace_resources.sql`; deploy it before code depends on primary workspace resources.

For production domain, Vercel, one.com DNS, and email setup under `avenro.se`, use [`avenro-domain-setup.md`](./avenro-domain-setup.md).

## Health Check

The public health endpoint is:

- `GET /api/health`

Expected response shape:

```json
{
  "ok": true,
  "service": "agentergroup-web",
  "environment": "production",
  "timestamp": "2026-06-04T00:00:00.000Z"
}
```

The endpoint returns no secrets, does not check third-party credentials, and sends `Cache-Control: no-store`. Use it for process availability, not deep dependency health.

## Deployment Verification

After deploying the dashboard app:

1. Confirm `/api/health` returns `ok: true`.
2. Confirm `/login`, `/privacy-policy`, and `/terms-of-service` load without authentication.
3. Confirm an authenticated app route redirects unauthenticated visitors to `/login`.
4. Run a smoke test for the dashboard build artifact through the hosting provider.
5. For billing, Composio, and privacy cron changes, verify the relevant route-level secret or signature checks before triggering live provider events.
6. For widget document-upload changes, upload a PDF or text file before the first chat message and confirm the session-scoped knowledge source is created with an internal widget-session UUID.
7. For Milo changes, confirm `/milo` resolves to the active workspace's primary Builder and `/website-chat` resolves to the primary full-screen editor.
8. Confirm Website Chat does not show the global sidebar/topbar during loading or after redirect, and its Back control returns to `/dashboard`.
9. Confirm a hosted and embedded Website Chat opens directly into Milo without a specialist chooser.
10. Confirm Leads, Analytics, and Improve Milo still resolve records from the active workspace only.
11. In Website Chat preview, change the theme/colors after opening a conversation and confirm the live preview updates without resetting chat; then save again after token rotation and confirm preview chat still succeeds.
12. Confirm canonical domain routing: `https://avenro.se` serves the Next.js app, `https://www.avenro.se` redirects to `https://avenro.se`, and `https://widget.avenro.se` serves Widget V2.

## Widget Runtime Deployment

The dashboard and widget runtime deploy separately.

Changes under `apps/widget-v2` are not live on `widget.avenro.se` until the widget runtime is deployed. After a widget runtime deploy:

1. Run `npm run widget:build` locally or confirm the equivalent CI step passed.
2. Open a hosted widget link for a deployed widget.
3. Confirm bootstrap succeeds and the first chat turn streams.
4. Confirm an expired widget access token path refreshes bootstrap once.
5. When testing load or same-session locking, use `npm run widget:load-test -- --help` for the supported harness options.

## Backup And Restore

Supabase owns durable database and storage state. Before high-risk migrations or launch events:

1. Confirm automated Supabase project backups are enabled for the production project.
2. Record the latest backup timestamp and retention window.
3. Export or snapshot critical configuration outside the app database when needed: environment variables, provider webhook URLs, Stripe product/price ids, and Composio project configuration.
4. For migrations that touch RLS, storage policies, triggers, or `security definer` functions, review the Supabase security checklist in `.agents/skills/supabase/SKILL.md` before applying.
5. Validate restore procedure in a non-production project before relying on it for production recovery.

Restore drills should confirm:

- workspace membership and RLS-protected data remain scoped correctly
- widget runtime rows, messages, leads, and dashboard summaries are present
- storage-backed knowledge files still resolve
- Edge Functions can process and search knowledge after restore
- Milo workspaces retain `product_experience`, both primary resource pointers, and the protected primary widget-agent link

## Incident Notes

For suspected data loss, privacy exposure, or provider webhook malfunction:

1. Preserve timestamps, workspace ids, actor ids, request ids, provider event ids, and relevant route names.
2. Check `audit_logs`, `runs`, `run_steps`, `automation_events`, and provider dashboards.
3. Avoid retrying provider write actions until idempotency and external side effects are understood.
4. Document the final cause and add or update a regression test when the issue maps to code.
