# Agentergroup

Agentergroup is a multi-workspace AI agent platform with a Next.js dashboard, a public widget runtime, Supabase-backed storage/auth, OpenRouter model routing, and Composio-powered external actions.

## Packages

- `.`: Main dashboard app built with Next.js 16.2.2, React 19, and Tailwind CSS v4.
- `apps/widget-v2`: Standalone hosted/embedded widget built with Vite 8 and React 18.

## What The Platform Does

- Build, configure, preview, publish, and archive AI agents.
- Use internal assistants in authenticated workspace chat surfaces.
- Attach knowledge sources and use them during agent conversations.
- Connect external tools such as Gmail, Google Calendar, and Google Drive through Composio.
- Deploy widgets for hosted usage or third-party site embedding.
- Track widget sessions, transcripts, leads, and analytics inside each workspace.
- Run owner-only privacy workflows for lookup, export, deletion, and retention cleanup.

## Current Product Guarantees

- Widget specialist settings are durable across save, preview, bootstrap, and deploy. Saved widget-agent labels, quick-action visibility, and quick actions are now treated as the runtime source of truth.
- Google Drive imports are account-specific. If a workspace has multiple connected Drive accounts, operators must select which account to browse and import from.
- Public remote downloads are SSRF-hardened. Assistant downloads and Drive imports only allow vetted `http/https` hosts, reject private/loopback destinations, and re-validate redirects.
- DSAR email lookups use normalized exact matching, not wildcard matching. Session ids used in export filenames are sanitized before being written into headers.
- Production chat persistence does not store raw debug traces or raw tool payloads. Conversation-detail debug traces are only returned to workspace owners/admins.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged Supabase key for admin routes and jobs |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Default model id for agent turns |
| `OPENROUTER_DATA_COLLECTION` | No | Provider privacy mode, defaults to `deny` |
| `OPENROUTER_REQUIRE_ZDR` | No | Enables OpenRouter ZDR preference when truthy |
| `COMPOSIO_API_KEY` | Yes for tool integrations | Composio API key |
| `COMPOSIO_TOOLKIT_VERSION_GMAIL` | No | Gmail toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR` | No | Google Calendar toolkit version override |
| `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE` | No | Google Drive toolkit version override |
| `NEXT_PUBLIC_APP_URL` | No | Dashboard origin, defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_WIDGET_APP_URL` | No | Hosted widget origin, defaults to `http://localhost:5173` |
| `WIDGET_APP_URL` | No | Legacy fallback alias for the hosted widget origin |
| `WIDGET_ACCESS_SECRET` | Yes | Secret used to sign public widget access tokens |
| `WIDGET_PREVIEW_SECRET` | Yes | Secret used to sign widget preview tokens |
| `RATE_LIMIT_SECRET` | Yes in production | Dedicated secret used to hash public rate-limit identities |
| `GDPR_RETENTION_CRON_SECRET` | Yes for retention job | Secret for the internal privacy retention route |

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
├── docs/                       # Current reference docs plus the active widget rate-limit plan
├── public/                     # Static assets served by the dashboard app
└── proxy.ts                    # Request/session proxy hook for auth session updates
```

## Important Routes

| Route | Purpose |
| --- | --- |
| `/login` | Supabase-authenticated login flow |
| `/dashboard` | Workspace overview and operational summary |
| `/agents` | Agent list and lifecycle actions |
| `/agents/[id]/builder` | Visual agent builder |
| `/agents/[id]/preview` | Live chat preview for draft agents |
| `/assistants` | Shared internal assistant list for the active workspace |
| `/assistants/[id]` | Internal assistant chat surface with shared workspace threads |
| `/widgets` | Widget list and management |
| `/widgets/[id]` | Widget configuration, agents, appearance, and deployment state |
| `/analytics` | Widget conversation analytics and transcript detail |
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
- Embedded widget abuse controls trust only edge-supplied client IP headers (`x-vercel-forwarded-for` and `cf-connecting-ip`); requests without them fall back to the shared `"unknown"` rate-limit bucket.
- Public widget/API failures now return stable client-safe errors while detailed exceptions stay in server logs.
- Public lead submissions now return only `ok`, `leadId`, and `createdAt`.
- The dashboard app now sends baseline browser protections through CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.
- Public widget rate limits are enforced through a Supabase RPC backed by a named uniqueness constraint on `rate_limit_windows`; do not switch that upsert back to a bare column-list conflict target or Postgres can reintroduce ambiguous `window_started_at` errors.
- Changes under `apps/widget-v2` require a separate widget-runtime deploy; pushing or deploying only the dashboard app does not update `widget.agentergroup.com`.
- Internal assistant chat is serialized per `chat_threads` row; overlapping turns return `409 THREAD_BUSY`.
- Internal assistants become usable after the first normal builder save; publish remains widget-only in v1.
- `scripts/widget-load-test.mjs` exercises bootstrap/chat flows and the same-session lock path.
- The security regression suite lives under `tests/security/*.test.ts` and currently covers redirect sanitization, trusted widget IP handling, widget CORS behavior, browser security headers, SSRF blocking, workspace ownership guards, DSAR normalization/sanitization, debug-trace redaction, and multi-account Drive selection.
- `npm audit --audit-level=moderate` currently passes in both the root app and `apps/widget-v2`.
- The top-level `/data-processing` and `/subprocessors` routes are compatibility redirects into `/settings/...`.
- Self-service password reset and a backup/restore operator runbook are follow-up work and are not part of the current launch-hardening batch.

## License

Private repository. All rights reserved. Agentergroup © 2026.
