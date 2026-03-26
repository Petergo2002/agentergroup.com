# Agentergroup

Agentergroup is a multi-workspace AI agent platform with a Next.js dashboard, a public widget runtime, Supabase-backed storage/auth, OpenRouter model routing, and Composio-powered external actions.

## Packages

- `.`: Main dashboard app built with Next.js 16, React 19, and Tailwind CSS v4.
- `apps/widget-v2`: Standalone hosted/embedded widget built with Vite and React 18.

## What The Platform Does

- Build, configure, preview, publish, and archive AI agents.
- Attach knowledge sources and use them during agent conversations.
- Connect external tools such as Gmail, Google Calendar, and Google Drive through Composio.
- Deploy widgets for hosted usage or third-party site embedding.
- Track widget sessions, transcripts, leads, and analytics inside each workspace.
- Run owner-only privacy workflows for lookup, export, deletion, and retention cleanup.

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
├── docs/                       # Architecture notes, rollout docs, and implementation plans
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

## Operational Notes

- Widget bootstrap currently issues a signed access token with a 15-minute TTL.
- Hosted and embedded widget clients both retry bootstrap once when the runtime token expires.
- Widget chat is serialized per session; overlapping turns return `409 SESSION_BUSY`.
- `scripts/widget-load-test.mjs` exercises bootstrap/chat flows and the same-session lock path.
- The top-level `/data-processing` and `/subprocessors` routes are compatibility redirects into `/settings/...`.

## License

Private repository. All rights reserved. Agentergroup © 2026.
