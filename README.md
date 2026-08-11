# Agentergroup

Agentergroup is a multi-workspace AI agent platform with a Next.js dashboard, a public widget runtime, Supabase-backed storage/auth, OpenRouter model routing, and Composio-powered external actions.

## Packages

- `.`: Main dashboard app built with Next.js 16, React 19, and Tailwind CSS v4. The resolved Next.js patch version is locked in `package-lock.json`.
- `apps/widget-v2`: Standalone hosted/embedded widget built with Vite 8 and React 18.

## What The Platform Does

- Build, configure, preview, publish, and archive AI agents.
- Use internal assistants in authenticated workspace chat surfaces.
- Attach knowledge sources and use them during agent conversations.
- Connect external tools such as Gmail, Google Calendar, and Google Drive through Composio.
- Create automation agents that start from external Composio triggers, beginning with Gmail new-message events, and then run the configured agent with selected tools and knowledge.
- Deploy widgets for hosted usage or third-party site embedding.
- Track widget sessions, transcripts, leads, and analytics inside each workspace.
- Review unanswered visitor questions in the Questions queue and publish verified answers back into agent knowledge.
- Run owner-only privacy workflows for lookup, export, deletion, and retention cleanup.

## Current Product Guarantees

- Widget specialist settings are durable across save, preview, bootstrap, and deploy. Saved widget-agent labels, quick-action visibility, and quick actions are now treated as the runtime source of truth.
- Google Drive imports are account-specific. If a workspace has multiple connected Drive accounts, operators must select which account to browse and import from.
- Public remote downloads are SSRF-hardened. Assistant downloads and Drive imports only allow vetted `http/https` hosts, reject private/loopback destinations, and re-validate redirects. Drive imports also time out and stop reading as soon as they exceed the workspace's remaining knowledge-storage allowance.
- DSAR email lookups use normalized exact matching, not wildcard matching. Session ids used in export filenames are sanitized before being written into headers.
- Production chat persistence does not store raw debug traces or raw tool payloads. Conversation-detail debug traces are only returned to workspace owners/admins.
- Automation activity is event-centered rather than conversational. Each run stores a versioned operational decision, generated-message preview, summary, missing-information list, and tool outcomes; successful actions require successful tool evidence, and production persistence excludes raw tool payloads.
- The Questions queue is deterministic and service-captured from public widget chats only after assistant replies are persisted. Preview widget chats are intentionally excluded. Repeat open misses update the original row with occurrence metadata and latest activity instead of creating duplicate open rows.

## Local Development

### 1. Install dependencies

```bash
npm install
npm install --prefix apps/widget-v2
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
cp apps/widget-v2/.env.example apps/widget-v2/.env.local
```

Root app variables:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL for browser/server clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Yes | Current Supabase secret key for admin routes and jobs |
| `SUPABASE_SERVICE_ROLE_KEY` | Temporary fallback | Legacy privileged Supabase key while older deployments are migrated |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Default model id for agent turns |
| `OPENROUTER_DATA_COLLECTION` | No | Provider privacy mode, defaults to `deny` |
| `OPENROUTER_REQUIRE_ZDR` | No | Enables OpenRouter ZDR preference when truthy |
| `FIRECRAWL_API_KEY` | Yes for website knowledge | Firecrawl API key for page mapping and ingestion |
| `RESEND_API_KEY` | Yes for invite email delivery | Resend API key; invite creation still works without delivery |
| `EMAIL_FROM_ADDRESS` | No | Invite-email sender, defaults to `Agentergroup <noreply@agentergroup.com>` |
| `COMPOSIO_API_KEY` | Yes for tool integrations | Composio API key |
| `COMPOSIO_WEBHOOK_SECRET` | Yes for automations | Secret used to verify Composio trigger webhooks |
| `COMPOSIO_TOOLKIT_VERSION_GMAIL` | No | Gmail toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR` | No | Google Calendar toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_CAL` | No | Cal.com toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE` | No | Google Drive toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_OUTLOOK` | No | Microsoft Outlook toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_SLACK` | No | Slack toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_HUBSPOT` | No | HubSpot toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_SHOPIFY` | No | Shopify toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_GOOGLEADS` | No | Google Ads toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_TEXT_TO_PDF` | No | Internal assistant PDF toolkit version override |
| `COMPOSIO_GMAIL_AUTH_CONFIG_ID` | No | Existing Gmail auth-config override; managed auth is used when empty. Create custom Gmail OAuth configs in Composio rather than supplying raw Google credentials to this app. |
| `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID` | No | Existing Shopify auth-config id |
| `COMPOSIO_SHOPIFY_CLIENT_ID` | Required without Shopify auth config | Shopify custom OAuth client id |
| `COMPOSIO_SHOPIFY_CLIENT_SECRET` | Required without Shopify auth config | Shopify custom OAuth client secret |
| `COMPOSIO_SHOPIFY_OAUTH_REDIRECT_URI` | Required for custom Shopify OAuth | Shopify OAuth callback |
| `COMPOSIO_SHOPIFY_SCOPES` | No | Optional Shopify OAuth scope override |
| `NEXT_PUBLIC_APP_URL` | No | Dashboard origin, defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_WIDGET_APP_URL` | No | Hosted widget origin, defaults to `http://localhost:5173` |
| `NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED` | No | Enables customer-facing Stripe checkout only when set to `true`; managed plan activation is the default |
| `WIDGET_APP_URL` | No | Legacy fallback alias for the hosted widget origin |
| `WIDGET_ACCESS_SECRET` | Yes | Secret used to sign public widget access tokens |
| `WIDGET_PREVIEW_SECRET` | Yes | Secret used to sign widget preview tokens |
| `RATE_LIMIT_SECRET` | Yes in production | Dedicated secret used to hash public rate-limit identities |
| `LEGAL_CONSENT_SECRET` | Recommended in production | Dedicated secret for short-lived signup consent tokens; falls back to `RATE_LIMIT_SECRET` or `WIDGET_ACCESS_SECRET` |
| `GDPR_RETENTION_CRON_SECRET` | Yes for retention job | Secret for the internal privacy retention route |
| `STRIPE_SECRET_KEY` | Yes for billing | Stripe secret key used lazily by billing routes |
| `STRIPE_WEBHOOK_SECRET` | Yes for billing webhooks | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` | Yes for billing | Stripe Starter recurring price id; no source fallback exists |
| `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` | Yes for billing | Stripe Premium recurring price id; no source fallback exists |
| `STRIPE_EXTRA_CREDITS_500_PRICE_ID` | Yes for extra credits | Stripe one-time price id for the 500-message credit pack |

Widget package variables:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE` | No | Build-time override for the dashboard API origin |

### 3. Run the apps

```bash
# Dashboard app
npm run dev

# Widget runtime, in a second terminal
npm run widget:dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard and [http://localhost:5173](http://localhost:5173) for the hosted widget runtime.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run widget:dev
npm run widget:build
npm run widget:load-test -- --help
```

## Repository Layout

```text
.
├── src/
│   ├── app/                    # Next.js routes, layouts, server actions, and API handlers
│   ├── components/             # Dashboard UI, modals, layout, and widget previews
│   └── lib/                    # Shared runtime, Supabase, widget, privacy, and integration helpers
├── apps/
│   └── widget-v2/              # Standalone widget runtime and embed assets
├── supabase/
│   ├── functions/              # Edge functions for knowledge processing/search
│   └── migrations/             # Database schema and platform migrations
├── scripts/                    # Load testing and utility scripts
├── docs/                       # Current architecture, feature guides, and operations runbooks
├── public/                     # Static assets served by the dashboard app
└── middleware.ts               # Request middleware; delegates auth/session handling to src/lib/supabase/proxy.ts
```

The live Supabase schema snapshot is generated into
`src/lib/supabase/database.types.ts`. Refresh it after an approved migration
with `npx supabase gen types typescript --linked >
src/lib/supabase/database.types.ts`, then run the type check and full release
gate. The shared clients remain intentionally unparameterized while legacy
domain JSON adapters are introduced incrementally.

## Important Routes

| Route | Purpose |
| --- | --- |
| `/login` | Supabase-authenticated login flow |
| `/signup` | Legacy signup redirect into the main login flow |
| `/terms-of-service` | Public Terms of Service page |
| `/invite/accept` | Public workspace invite acceptance (unauthenticated-friendly) |
| `/dashboard` | Workspace overview with summary stats and recent conversations |
| `/agents` | Agent list and lifecycle actions |
| `/agents/[id]/builder` | Visual agent builder |
| `/agents/[id]/preview` | Live chat preview for draft agents |
| `/agents/[id]/activity` | Automation event timeline, operational decisions, action outcomes, and run diagnostics |
| `/assistants` | Shared internal assistant list for the active workspace |
| `/assistants/[id]` | Internal assistant chat surface with shared workspace threads |
| `/widgets` | Widget list and management |
| `/widgets/[id]` | Widget configuration, agents, appearance, and deployment state |
| `/questions` | Review unanswered widget questions, publish verified answers, dismiss misses, and mark duplicates |
| `/analytics` | Widget conversation analytics, transcript detail, and automation performance reporting |
| `/connections` | Connected app authorization and status |
| `/settings` | Workspace profile, compliance links, and admin settings |

## Widget Embedding

The widget loader is built from `apps/widget-v2/public/loader.js` and expects a widget public key:

```html
<script
  src="https://widget.agentergroup.com/loader.js"
  data-widget="YOUR_WIDGET_PUBLIC_KEY"
  async
></script>
```

The loader and hosted runtime talk to the public API routes under `/api/public/widgets/`.

Hosted standalone links such as `https://widget.agentergroup.com/?widget=...` are served by the separate `apps/widget-v2` runtime deployment, not by the Next.js dashboard bundle itself.

This embed stays intentionally simple for local-business customers: they paste the loader snippet into their site and do not need to run any backend code or generate customer-side auth tokens.

Embedded `allowed_origins` checks are a soft abuse-control for normal website installs, not a hard security boundary against determined scripted clients. The hard runtime secret stays on the Agentergroup backend and is only used to mint short-lived widget access tokens after bootstrap succeeds.

## Widget Configuration Model

- `widgets` stores the surface-level widget identity, branding, deployment, and access settings.
- `widget_agents` stores the ordered specialist list and the runtime-facing specialist configuration:
  - display label
  - description
  - greeting
  - placeholder
  - quick-action visibility
  - quick actions
  - contact-form settings
- Deploy snapshots `widget_agents.published_version_id` for chat execution, while current widget/widget-agent config remains the live source for branding and specialist presentation.
- Internal widget preview uses `widget_preview_drafts` and signed preview tokens, but no longer rewrites specialist labels during preview generation.

## Google Drive Imports

- Drive remains a knowledge-import source only. Imported files become normal `knowledge_sources` rows after upload and processing.
- The `/knowledge` UI now loads connected Drive accounts and requires an explicit account choice when more than one Drive connection is available.
- The backend passes the selected connection through list, metadata, and download calls so imports never silently fall back to the first connected account.

## Operational Notes

- Widget bootstrap currently issues a signed access token with a 15-minute TTL.
- Hosted and embedded widget clients both retry bootstrap once when the runtime token expires.
- Hosted standalone widget mode is desktop-first on large breakpoints and keeps the compact shell only for smaller screens.
- Widget chat is serialized per session; overlapping turns return `409 SESSION_BUSY`.
- PDF and text files uploaded in a widget are indexed as session-scoped knowledge. The source row references the internal `widget_sessions.id` UUID and is deleted with that session.
- Embedded widget abuse controls trust only edge-supplied client IP headers (`x-vercel-forwarded-for` and `cf-connecting-ip`); requests without them fall back to the shared `"unknown"` rate-limit bucket.
- Public widget/API failures now return stable client-safe errors while detailed exceptions stay in server logs.
- Public lead submissions now return only `ok`, `leadId`, and `createdAt`.
- Questions/Data Flywheel capture runs from the public widget chat route after the assistant response has been saved. `src/lib/flywheel/detection.ts` uses deterministic English/Swedish question-intent, missing-answer, noise-guard, and question-cleanup rules; it does not call an extra classifier model.
- Captured misses are stored in `unanswered_queries`. Customer-approved answers create `verified_facts`, a text `knowledge_sources` row, place that source in the agent's auto-managed verified answers folder, then enqueue normal knowledge processing.
- `GET /api/flywheel/unanswered` returns a status-scoped `questions` list plus server-side `counts`. The `/questions` UI requests the selected status directly so a capped mixed-status result set cannot hide open questions.
- Open question dedupe is workspace + agent scoped. Exact and near-duplicate open repeats update occurrence metadata, latest message/session references, confidence, and `updated_at`; they do not create another open row.
- Supabase runs `close-stale-widget-sessions` every 5 minutes through `pg_cron`. It marks hosted/embedded active widget sessions as `completed` with `inactivity_timeout` after 30 minutes without `last_seen_at` activity; Analytics still uses a separate 90-second app-side window to label active sessions as live versus idle.
- Widget leads can have a persisted AI conversation summary. Generation runs after the response lifecycle, consumes one workspace message credit per attempt, and can be regenerated from Leads or Analytics when the transcript changes. See `docs/guides/lead-conversation-summaries.md`.
- Analytics includes an Automation view with event totals, processed/failed trends, and recent failures that link back to Activity. Automation analytics excludes raw provider payloads and raw email bodies.
- The dashboard app now sends baseline browser protections through CSP, HSTS, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.
- Dashboard CSP allows Supabase only when `NEXT_PUBLIC_SUPABASE_URL` is configured; it must not fall back to a hardcoded project hostname.
- Public widget rate limits are enforced through a Supabase RPC backed by a named uniqueness constraint on `rate_limit_windows`; do not switch that upsert back to a bare column-list conflict target or Postgres can reintroduce ambiguous `window_started_at` errors.
- `RATE_LIMIT_SECRET` must be a dedicated production secret. The app no longer falls back to `SUPABASE_SERVICE_ROLE_KEY` for rate-limit identity hashing, and production logs a warning if it has to reuse `WIDGET_ACCESS_SECRET`.
- OpenRouter-backed turns consume workspace message quota before model calls in public widget chat, widget-builder preview chat, internal assistant chat, agent preview chat, prompt optimization, and automation runs.
- Middleware is explicit-public/default-auth: any matched route not listed as public in `src/lib/supabase/proxy.ts` requires a valid Supabase session.
- Stripe billing config is required at route execution time and has no hardcoded price id fallbacks.
- Changes under `apps/widget-v2` require a separate widget-runtime deploy; pushing or deploying only the dashboard app does not update `widget.agentergroup.com`.
- Internal assistant chat is serialized per `chat_threads` row; overlapping turns return `409 THREAD_BUSY`.
- Internal assistants become usable after the first normal builder save; publish remains widget-only in v1.
- `scripts/widget-load-test.mjs` exercises bootstrap/chat flows and the same-session lock path.
- The security regression suite lives under `tests/security/*.test.ts` and covers auth redirects, automation event claiming, billing guards, connection rebinding, Composio failures/cache behavior, knowledge folders and session search, quota enforcement, middleware defaults, widget CORS/headers/validation, SSRF, privacy sanitization, and workspace ownership.
- The root app and `apps/widget-v2` currently pass
  `npm audit --audit-level=moderate` with zero reported vulnerabilities; see
  `docs/runbooks/production-readiness.md`.
- The top-level `/data-processing` and `/subprocessors` routes are compatibility redirects into `/settings/...`.
- Self-service password reset is available from `/login/forgot-password` and authenticated Settings. The backup/restore and deploy verification runbook lives in `docs/runbooks/operations.md`.
- Profile upsert on each authenticated request is optimized via `src/lib/app/profile-sync.ts`: the helper reads the existing profile first and skips the write when nothing has changed.
- The dashboard home page (`/dashboard`) loads workspace summary stats (agents, widgets, connected apps, knowledge sources, leads, and recent conversations) server-side through `src/lib/dashboard/summary.ts`.
- `dashboard_conversation_summaries` is a materialized Postgres table kept current by triggers on `widget_sessions`, `widget_session_messages`, and `widget_leads`. It powers the analytics inbox without per-request aggregations.
- Performance indexes added in `20260525210001_app_slow_query_tuning.sql` and `20260526212615_dashboard_performance_quick_wins.sql` improve common dashboard and connection queries.

## License

Private repository. All rights reserved. Agentergroup © 2026.
