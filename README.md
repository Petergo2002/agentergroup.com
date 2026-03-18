# Agentergroup — AI Agent Platform

A full-stack SaaS platform for building, deploying, and embedding AI agents into any product. Built with **Next.js 16 (App Router)**, **Supabase**, **OpenRouter**, and **Composio**.

---

## What It Does

- **Build AI Agents** — Create and configure agents with custom instructions, models, and published versions.
- **Widget System** — Embed an AI chat widget on any website via a lightweight embeddable script (`widget-v2`).
- **Live Preview** — Preview widget changes in real time with signed preview tokens and draft payloads.
- **Connections** — Integrate third-party tools via Composio (e.g. Gmail, Notion, GitHub).
- **Knowledge Base** — Attach knowledge sources to agents for contextual retrieval.
- **Multi-Workspace** — Scoped workspaces with per-workspace agents, widgets, and settings.
- **Auth** — Supabase Auth with SSR session handling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database / Auth | Supabase (Postgres + Auth + RLS) |
| AI Inference | OpenRouter (multi-model) |
| Tool Integrations | Composio |
| Widget Canvas | React (`apps/widget-v2`) |
| Flow Builder | `@xyflow/react` |
| Animation | Framer Motion |

---

## Project Structure

```
.
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── (app)/              # Authenticated dashboard shell
│   │   ├── agents/             # Agent builder & preview pages
│   │   ├── api/
│   │   │   ├── agents/         # Agent chat & management endpoints
│   │   │   ├── widgets/        # Widget CRUD, deploy, preview endpoints
│   │   │   ├── public/widgets/ # Public widget runtime endpoints (chat, events, sessions)
│   │   │   ├── connections/    # Composio integration endpoints
│   │   │   ├── dashboard/      # Dashboard data endpoints
│   │   │   ├── knowledge/      # Knowledge base endpoints
│   │   │   └── workspaces/     # Workspace management
│   │   ├── auth/               # Auth callback handlers
│   │   └── login/              # Login page
│   ├── components/             # Shared React components
│   ├── lib/
│   │   ├── agents/             # Agent runtime logic
│   │   ├── widgets/            # Widget server utilities & type-safe query helpers
│   │   ├── runtime/            # AI inference & streaming helpers
│   │   ├── supabase/           # Supabase client factories (server, client, admin)
│   │   ├── openrouter.ts       # OpenRouter API client
│   │   ├── composio.ts         # Composio tool integration
│   │   ├── types.ts            # Shared TypeScript types (DB row shapes)
│   │   └── widgets.ts          # Widget config builders & helpers
│   └── supabase/               # Supabase migrations
└── apps/
    └── widget-v2/              # Embeddable chat widget (standalone React build)
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | Default model (e.g. `openai/gpt-4o-mini`) |
| `COMPOSIO_API_KEY` | Composio API key for tool integrations |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |

### 3. Run the development server

```bash
# Main dashboard app
npm run dev

# Widget (in a separate terminal)
npm run widget:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

```bash
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run widget:dev    # Start widget-v2 dev server
npm run widget:build  # Build widget-v2 for production
```

---

## Key Routes

| Route | Description |
|---|---|
| `/` | Redirects to dashboard |
| `/login` | Auth page |
| `/dashboard` | Main workspace dashboard |
| `/agents` | Agents list |
| `/agents/[id]/builder` | Agent flow builder |
| `/agents/[id]/preview` | Live agent chat preview |
| `/connections` | Third-party tool connections |
| `/settings` | Workspace settings |

---

## Widget Embedding

The `widget-v2` app compiles to a self-contained script. To embed on any site:

```html
<script src="https://widget.agentergroup.com/loader.js"
  data-widget-key="YOUR_WIDGET_PUBLIC_KEY"
  async>
</script>
```

The widget communicates with the platform via the public API routes under `/api/public/widgets/`.

---

## License

Private — All rights reserved. Agentergroup © 2026.
