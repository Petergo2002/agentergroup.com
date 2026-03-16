# Agent Platform

Phase 1 of the Agentergroup product shell lives in this repo.

This build is intentionally focused on structure and UI:

- app shell
- responsive navigation
- dashboard
- agents list
- dedicated builder route
- agent preview
- connections
- settings
- modal and toast presentation

There is no Supabase, Trigger.dev, OpenRouter, or Composio logic wired here yet. Data is still mock data and interactions are local-only.

## Routes

- `/dashboard`
- `/agents`
- `/agents/[id]/builder`
- `/agents/[id]/preview`
- `/connections`
- `/settings`

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Current Scope

Phase 1 should feel complete from a product-shell perspective:

- polished desktop layout
- mobile navigation fallback
- static page states
- builder canvas presentation
- reusable UI chrome

The next phases will add auth, persistence, app connections, and runtime execution.
