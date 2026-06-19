# Agentergroup Architecture

Last updated: 2026-06-07

## Purpose

This document is the implementation-level architecture reference for the current Agentergroup codebase. It explains:

- what the system does today
- which services and APIs it depends on
- how the frontend, backend, database, knowledge base, and integrations fit together
- where the main source-of-truth logic lives
- how to extend the system safely

This document should be treated as the operational source of truth for future maintainers. The phase docs in `docs/` describe roadmap intent; this document describes the current implementation.

## Product Scope

The current product is a conversational AI agent platform with four core capabilities:

1. Build and configure agents in a visual editor
2. Run agents in a live preview chat
3. Use internal assistants in shared authenticated workspace chats
4. Let agents use:
   - workspace knowledge stored in Supabase
   - connected external tools through Composio

The current MVP is intentionally narrow:

- chat-first agent runtime
- Automation agents with Composio external trigger ingestion, starting with Gmail
- workspace-scoped knowledge base with semantic retrieval
- limited live tools for Gmail, Microsoft Outlook, Slack, HubSpot, Shopify, Google Ads, Google Calendar, and Cal.com
- Google Drive only as a knowledge import source
- internal assistant toolkit for Text to PDF generation

This is not a general workflow automation platform. There is no active Trigger.dev orchestration and no separate multi-step workflow engine. Automation v1 is intentionally limited to external Composio triggers on automation agents, starting with Gmail. Those trigger events run through the shared agent runtime, so the automation can use the saved instructions, selected knowledge sources, and selected Composio tool nodes when the payload and instructions clearly require action.

## High-Level System

```text
Browser (Next.js App Router UI)
  -> Next.js route handlers
    -> Supabase Postgres (app data)
    -> Supabase Storage (raw uploaded knowledge files)
    -> Supabase Edge Functions (knowledge processing + semantic search)
    -> OpenRouter (LLM chat completions)
    -> Composio (tool auth, connected accounts, tool execution)
    -> Composio Webhooks (automation trigger events)
```

### Main responsibility split

- Next.js app:
  - UI
  - authenticated pages
  - server route handlers
  - orchestration between Supabase, OpenRouter, and Composio
- Supabase Postgres:
  - primary durable application state
  - agents, connections, threads, runs, knowledge metadata
- Supabase Storage:
  - raw uploaded knowledge files
- Supabase Edge Functions:
  - chunking, embeddings, vector ingestion
  - semantic retrieval RPC entrypoint
- OpenRouter:
  - model inference
- Composio:
  - external app connection/auth state
  - tool discovery and execution

## Technology Stack

### Frontend and app server

- Next.js 16, with the exact resolved patch version locked in `package-lock.json`
- React `19.2.3`
- TypeScript
- Tailwind CSS v4
- App Router

### Runtime and integrations

- Supabase SSR client via `@supabase/ssr`
- Supabase JS client via `@supabase/supabase-js`
- OpenRouter chat completions API
- Composio via `@composio/core`
- React Flow via `@xyflow/react` for the builder canvas

### Persistence and AI infra

- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions
- `pgvector` in Postgres
- Supabase native embeddings through `Supabase.ai.Session("gte-small")`

## Repository Structure

Important implementation docs:

- `docs/guides/agent-builder.md`
- `docs/guides/automation-agents.md`
- `docs/architecture/core.md`
- `docs/guides/composio-integrations.md` — **read this before writing any Composio tool integration**

### Core app routes

- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/analytics/page.tsx`
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/agents/[id]/builder/page.tsx`
- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/app/(app)/assistants/page.tsx`
- `src/app/(app)/assistants/[id]/page.tsx`
- `src/app/(app)/widgets/page.tsx`
- `src/app/(app)/widgets/[id]/page.tsx`
- `src/app/(app)/widgets/[id]/preview/page.tsx`
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/knowledge/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/billing/page.tsx`
- `src/app/(app)/settings/team/page.tsx`
- `src/app/(app)/settings/subprocessors/page.tsx`
- `src/app/(app)/settings/data-processing/page.tsx`
- `src/app/privacy-policy/page.tsx`
- `src/app/subprocessors/page.tsx`
- `src/app/data-processing/page.tsx`
- `src/app/login/page.tsx`
- `src/app/login/actions.ts`
- `src/app/auth/confirm/route.ts`
- `src/app/complete-signup/page.tsx`

### Server APIs

- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/active/route.ts`
- `src/app/api/workspaces/[id]/route.ts`
- `src/app/api/workspaces/[id]/members/route.ts`
- `src/app/api/workspaces/[id]/members/[memberId]/route.ts`
- `src/app/api/workspaces/[id]/invites/route.ts`
- `src/app/api/workspaces/[id]/invites/[inviteId]/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/lookup/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/export/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/delete/route.ts`
- `src/app/api/invites/incoming/route.ts`
- `src/app/api/invites/accept/route.ts`
- `src/app/api/invites/decline/route.ts`
- `src/app/api/internal/privacy/retention/route.ts`
- `src/app/api/admin/workspaces/[id]/internal-assistants/route.ts`
- `src/app/api/agents/[id]/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/api/agents/[id]/knowledge/route.ts`
- `src/app/api/agents/[id]/automation/route.ts`
- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/agents/[id]/archive/route.ts`
- `src/app/api/agents/[id]/rollback/route.ts`
- `src/app/api/agents/[id]/status/route.ts`
- `src/app/api/agents/[id]/widget/route.ts`
- `src/app/api/composio/webhook/route.ts`
- `src/app/api/assistants/route.ts`
- `src/app/api/assistants/[id]/route.ts`
- `src/app/api/assistants/[id]/threads/route.ts`
- `src/app/api/assistants/[id]/chat/route.ts`
- `src/app/api/assistants/[id]/downloads/[messageId]/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/extra-credits/checkout/route.ts`
- `src/app/api/billing/invoices/route.ts`
- `src/app/api/billing/portal/route.ts`
- `src/app/api/billing/webhook/route.ts`
- `src/app/api/connections/toolkits/route.ts`
- `src/app/api/connections/authorize/route.ts`
- `src/app/api/connections/auth-links/route.ts`
- `src/app/api/connections/auth-links/[id]/revoke/route.ts`
- `src/app/api/public/connection-auth-links/[token]/start/route.ts`
- `src/app/connect/[token]/page.tsx`
- `src/app/connect/callback/page.tsx`
- `src/app/api/connections/disconnect/route.ts`
- `src/app/api/connections/googlecalendar/calendars/route.ts`
- `src/app/api/connections/cal/event-types/route.ts`
- `src/app/api/knowledge/sources/route.ts`
- `src/app/api/knowledge/sources/[id]/route.ts`
- `src/app/api/knowledge/sources/[id]/content/route.ts`
- `src/app/api/knowledge/sources/[id]/process/route.ts`
- `src/app/api/knowledge/drive/files/route.ts`
- `src/app/api/knowledge/drive/import/route.ts`
- `src/app/api/widgets/route.ts`
- `src/app/api/widgets/[id]/route.ts`
- `src/app/api/widgets/[id]/agents/route.ts`
- `src/app/api/widgets/[id]/deploy/route.ts`
- `src/app/api/widgets/[id]/preview/route.ts`
- `src/app/api/widgets/[id]/status/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/bootstrap/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/config/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/complete/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/events/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts`
- `src/app/api/dashboard/analytics/route.ts`
- `src/app/api/dashboard/summary/route.ts`
- `src/app/api/dashboard/analytics/conversations/[widgetSessionId]/route.ts`

### Core libraries

- `src/lib/env.ts`
- `src/lib/app/bootstrap.ts`
- `src/lib/app/profile-sync.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/openrouter.ts`
- `src/lib/composio.ts`
- `src/lib/integrations.ts`
- `src/lib/google-calendar.ts`
- `src/lib/cal.ts`
- `src/lib/knowledge.ts`
- `src/lib/runtime/observability.ts`
- `src/lib/runtime/agent-chat.ts`
- `src/lib/agents/defaults.ts`
- `src/lib/widgets.ts`
- `src/lib/widgets/server.ts`
- `src/lib/dashboard/analytics.ts`
- `src/lib/dashboard/summary.ts`
- `src/lib/privacy.ts`
- `src/lib/end-chat.ts`
- `src/lib/types.ts`

### Supabase

- `supabase/migrations/20260313_phase_2_core_platform.sql`
- `supabase/migrations/20260314_phase_3_runtime_controls.sql`
- `supabase/migrations/20260314_phase_4_knowledge_base.sql`
- `supabase/migrations/20260314_phase_4_storage_and_advisor_cleanup.sql`
- `supabase/migrations/20260314_phase_4_widget_deployments.sql`
- `supabase/migrations/20260315_phase_5_widgets_multi_agent.sql`
- `supabase/migrations/20260315_phase_5_1_widget_preview_drafts.sql`
- `supabase/migrations/20260315_phase_5_2_widget_agent_quick_prompts.sql`
- `supabase/migrations/20260315_phase_5_3_widget_assets.sql`
- `supabase/migrations/20260319_widget_hosted_access.sql`
- `supabase/migrations/20260320_end_chat_sessions.sql`
- `supabase/migrations/20260323_phase_7_privacy_retention_indexes.sql`
- `supabase/migrations/20260325_widget_session_turn_locks.sql`
- `supabase/migrations/20260325_widget_session_turn_locks_fix_status_ambiguity.sql`
- `supabase/migrations/20260325_widget_session_turn_locks_fix_active_turn_ambiguity.sql`
- `supabase/migrations/20260326_internal_assistants.sql`
- `supabase/migrations/20260409_widget_rate_limits.sql`
- `supabase/migrations/20260409163000_widget_rate_limit_window_conflict_fix.sql`
- `supabase/migrations/20260416_team_invites.sql`
- `supabase/migrations/20260419110605_add_website_knowledge_source.sql`
- `supabase/migrations/20260422183115_widget_attachments_bucket.sql`
- `supabase/migrations/20260429114632_admin_extra_message_credits.sql`
- `supabase/migrations/20260503102209_automation_agents_v1.sql`
- `supabase/migrations/20260507000000_connections_one_per_toolkit.sql`
- `supabase/migrations/20260512102248_purchased_message_credits.sql`
- `supabase/migrations/20260512105825_connection_auth_links.sql`
- `supabase/migrations/20260512113836_secure_security_definer_functions.sql`
- `supabase/migrations/20260512114059_tighten_private_helper_function_grants.sql`
- `supabase/migrations/20260518170742_agent_library_templates.sql`
- `supabase/migrations/20260520132303_knowledge_folders.sql`
- `supabase/migrations/20260525210001_app_slow_query_tuning.sql`
- `supabase/migrations/20260526212615_dashboard_performance_quick_wins.sql`
- `supabase/migrations/20260526213651_dashboard_conversation_summaries.sql`
- `supabase/functions/process-knowledge-source/index.ts`
- `supabase/functions/search-knowledge/index.ts`
- `supabase/functions/_shared/knowledge.ts`

### Widget runtime app

- `apps/widget-v2/src/main.tsx`
- `apps/widget-v2/src/Widget.tsx`
- `apps/widget-v2/src/lib/api.ts`
- `apps/widget-v2/public/loader.js`

## App Routing and Shell

### Public routes

- `/`
- `/login`
- `/signup`
- `/terms-of-service`
- `/privacy-policy`
- `/data-processing`
- `/subprocessors`
- `/invite/*`
- `/connect/*`

### Authenticated app routes

All authenticated product routes live under the route group:

- `src/app/(app)`

The authenticated layout in `src/app/(app)/layout.tsx` does the following:

1. Verifies required Supabase environment variables exist
2. Loads the authenticated user from Supabase
3. Redirects unauthenticated users to `/login`
4. Calls `ensureWorkspaceContext(...)`
5. Wraps the route tree in `AppShell`

### App shell behavior

`src/components/layout/AppShell.tsx` is the main authenticated shell.

It provides:

- `AppContextProvider`
- `ToastProvider`
- `ModalProvider`
- the main sidebar
- the topbar

Important exception:

- `/agents/[id]/builder` intentionally renders without the global sidebar and topbar
- the builder route still keeps app context and providers
- this gives the editor a focused full-screen layout without breaking shared state

Additional note:

- internal assistant usage now lives under `/assistants`
- widget management now lives under `/widgets`
- the legacy `/agents/[id]/widget` surface only redirects users into the widgets area
- analytics lives at `/analytics` as a workspace-level operations surface for widget conversations

### Workspace shell behavior

On standard app routes, workspace is now a first-class shell concept:

- the topbar contains a workspace switcher
- the sidebar shows the active workspace and the current membership role
- users can create a new workspace directly from the switcher

This is the current foundation for agency-style multi-client management.

## Authentication and Workspace Bootstrap

### Authentication flow

Authentication is handled by Supabase Auth with a professional "Email-first" flow.

- **Signup/Login**: Users enter only their email. The system uses `signInWithOtp` to send a branded Magic Link.
- **Verification**: The link directs users to `/auth/confirm`, which verifies the token and redirects to `/complete-signup`.
- **Completion**: New users set their password on `/complete-signup` before being redirected to `/onboarding`.
- **Legacy signup redirect**: `/signup` is a public route that redirects legacy signup links into the main login flow.
- **SMTP**: External emails are delivered via **Resend** (SMTP) to ensure professional branding (`@agentergroup.com`) and high deliverability.
- **Actions**: Login, signup, and password update actions live in `src/app/login/actions.ts`.
- **Redirects**: Environment-agnostic redirects are managed via `getAppUrl()` in `src/lib/env.ts`.

### Workspace bootstrap flow

`src/lib/app/bootstrap.ts` guarantees that every authenticated user has:

- a `profiles` row
- at least one workspace
- at least one workspace membership
- one active workspace in app context

**Profile sync:**
Profile upsert logic is now extracted into `src/lib/app/profile-sync.ts` as `syncUserProfile()`. It:
- Compares the existing DB profile against Supabase Auth metadata (email, full_name, avatar_url)
- Skips the write when nothing has changed (read-first optimization)
- Handles concurrent first-login race conditions through duplicate-key detection and a retry read

**Concurrency & Race Conditions:**
The bootstrap logic is hardened against concurrent requests (e.g., a user opening multiple tabs during their first login). 
- `getOrCreateUserWorkspaces` uses a `try/catch` block during workspace creation.
- If a creation fails due to a race condition (duplicate slug), it fallbacks to a secondary check for existing memberships before failing.
- Workspace slugs use a retry-loop with incremental suffixes to ensure uniqueness.

Current behavior:

1. Call `syncUserProfile()` to upsert the profile from Supabase Auth user metadata
2. Load all workspace memberships for the user
3. If none exist, attempt to create a default owner workspace (with concurrency protection)
4. Resolve the active workspace using:
   - `active_workspace_id` cookie if it still matches a valid membership
   - otherwise the first owner workspace
   - otherwise the first available membership
5. Return:
   - profile
   - active workspace
   - active membership
   - all available workspaces
   - subscription (automatic 'free' plan via DB trigger)

This logic is important because almost all app data is workspace-scoped.

### Active workspace selection

The active workspace is session-scoped through an HTTP-only cookie:

- `active_workspace_id`

It is written through:

- `POST /api/workspaces`
- `POST /api/workspaces/active`

This keeps workspace switching centralized in bootstrap/context instead of spreading special logic through individual pages.

## Subscription and Billing

### Plan tiers

The product uses a tiered subscription model with three plan levels:

- `free`
- `starter`
- `premium`

Each plan defines limits for:

- monthly message allowance (`messages_limit`)
- active agent count (`agents_limit`)
- integration access (`integrations_enabled`)
- team member capacity (enforced in the team invite flow)
- website crawling limits (hardcoded per tier)

### Data model

Subscription state is stored in:

- `workspace_subscriptions`

Key fields:

- `plan_tier`: the current plan level
- `messages_limit`: total messages allowed per billing cycle
- `messages_used`: messages consumed in the current cycle
- `agents_limit`: maximum active agents
- `integrations_enabled`: whether external tool integrations are unlocked
- `storage_limit_bytes`: maximum knowledge base storage (default 10MB, premium 50MB)
- `billing_cycle_start` / `billing_cycle_end`: current cycle window
- `stripe_customer_id` / `stripe_subscription_id`: Stripe identifiers (nullable for free plans)

### Message quota enforcement

Billable model entry points must call `consumeWorkspaceMessageUsage()` in `src/lib/message-usage.ts`
before making an OpenRouter-backed request. The helper calls the service-role-only
`increment_workspace_message_usage()` RPC and returns `402 MESSAGE_LIMIT_REACHED` semantics when
the workspace has exhausted its cycle allowance.

Current quota-covered entry points:

- public widget chat: `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
  - includes signed widget-builder preview chat; preview-token traffic skips public volumetric rate limiting, not credit usage
- internal assistant chat: `src/app/api/assistants/[id]/chat/route.ts`
- agent preview chat: `src/app/api/agents/[id]/chat/route.ts`
- prompt optimization: `src/app/api/agents/[id]/optimize-prompt/route.ts`
- automation trigger execution: `src/lib/automation/executor.ts`

Prompt optimization and preview chat count against the same monthly allowance as normal chat.
Automations also count against the workspace allowance so external trigger volume cannot create
unbounded OpenRouter spend.

### Bootstrap integration

The workspace bootstrap in `src/lib/app/bootstrap.ts` now loads the subscription record alongside the workspace context.

The `AppWorkspaceContext` type includes a `subscription` field of type `WorkspaceSubscriptionRecord`, which is available to all authenticated pages through `useAppContext()`.

### Billing UI

The billing settings page lives at:

- `src/app/(app)/settings/billing/page.tsx`

Current billing UI surfaces:

- message usage progress bar with percentage and reset date
- current plan display with pricing
- plan comparison grid (Free / Starter / Premium) with feature lists
- self-serve 500-message extra credit checkout for paid workspaces
- payment method display with Stripe billing portal handoff
- billing history table populated from Stripe invoices, with PDF downloads when available

Current plan pricing:

- Free: $0/mo — 50 messages, 1 agent, community support
- Starter: $30/mo — 500 messages, up to 3 agents, full integrations, priority support
- Premium: $110/mo — 4000 messages, unlimited agents, full integrations, dedicated support

### Current limitations

- subscription upgrades use Stripe Checkout and downgrade/payment-method changes hand off to the Stripe billing portal rather than editing billing details inline
- extra credit purchases are fixed to one 500-message pack and require `STRIPE_EXTRA_CREDITS_500_PRICE_ID`
- message counting is enforced before OpenRouter-backed runtime calls; the security regression suite keeps those entry points covered

### Admin plan management

Internal admins can override the subscription plan for any workspace directly from the `/admin` panel.

**Entry point:**

The plan selector lives in the workspace detail sidebar at `/admin/workspaces/[id]`, below the Internal Assistants toggle.

**API route:**

`PATCH /api/admin/workspaces/[id]/plan`

Accepts `{ plan_tier: "free" | "starter" | "premium" }`. Protected by `isAdminUser()` check. Uses the service-role admin client, which bypasses RLS.

**Plan tier → limits mapping:**

| Plan | `messages_limit` | `agents_limit` | `integrations_enabled` | `team_member_limit` | `crawl_limit` | `sitemap_mapping` |
| --- | --- | --- | --- | --- | --- | --- |
| `free` | 50 | 1 | false | 0 | 1 page | No |
| `starter` | 500 | 3 | true | 2 | 1 page | No |
| `premium` | 4000 | 9999 (unlimited) | true | 10 | 30 pages | Yes |

**Important behavioral notes:**

- `crawl_limit` and `sitemap_mapping` are functional limits enforced at the API and UI layers based on the `plan_tier`, rather than stored as columns in `workspace_subscriptions` yet.
- `team_member_limit` is also enforced in application logic rather than stored as a database column. Pending invites count toward the same capacity as accepted non-owner members.
- Stripe is **not involved** — this is a direct database override for internal ops use (trials, billing corrections, etc.)
- `messages_used` is **not reset** when the plan changes — usage history is preserved
- The workspace user's billing UI will reflect the new plan tier immediately after their next page load (the `AppWorkspaceContext` is reloaded on each authenticated request via bootstrap)

### Admin extra message credits

Internal admins can add fixed extra message credits to a workspace from `/admin/workspaces/[id]`.

**API route:**

`POST /api/admin/workspaces/[id]/extra-credits`

Accepts `{ amount: 50 | 100 | 500 }`. Protected by `isAdminUser()` check. The route calls the service-role-only `grant_workspace_extra_messages()` RPC, which atomically increases `workspace_subscriptions.messages_limit` and writes an `audit_logs` entry.

Important notes:

- only `50`, `100`, and `500` are accepted; arbitrary client-provided amounts are rejected
- extra credits increase `messages_limit`; `messages_used` is preserved
- the RPC is revoked from `anon` and `authenticated`, and is granted only to `service_role`

### Self-serve extra message credits

Workspace owners and admins on paid plans can buy one self-serve credit pack from `/settings/billing`.

**API route:**

`POST /api/billing/extra-credits/checkout`

Accepts `{ workspaceId: string }`. The route requires a workspace `owner` or `admin`, rejects `free` plan workspaces, and creates a Stripe Checkout Session in `payment` mode using `STRIPE_EXTRA_CREDITS_500_PRICE_ID`.

**Credit pack:**

- `500` extra message credits
- applied to the current billing cycle by increasing `workspace_subscriptions.messages_limit`
- `messages_used` is preserved
- no separate credit-balance table exists

Stripe confirms purchases through `checkout.session.completed`. The webhook calls `grant_workspace_purchased_messages()`, which is service-role only and idempotent by Stripe Checkout Session id so webhook retries do not double-grant credits.


## Team Management

### Overview

Workspaces support multi-member teams with role-based access and an invite system.

### Roles

- `owner`: full workspace control, billing, delete
- `admin`: can manage members and invites, cannot delete workspace
- `member`: standard workspace access

### Data model

Team management uses:

- `workspace_members`: membership rows with role
- `workspace_invites`: pending, accepted, or revoked email invites

Key workspace invite fields:

- `email`: invited user's email
- `role`: currently limited to `admin`
- `token`: unique accept/decline token
- `status`: `pending`, `accepted`, or `revoked`
- `expires_at`: invite expiry timestamp
- `invited_by`: the user who created the invite

### Team settings UI

The team management page lives at:

- `src/app/(app)/settings/team/page.tsx`

It provides:

- current member list with roles
- member role editing (owner/admin only)
- member removal
- invite creation by email
- pending invite list with revoke action
- incoming invite notifications for the current user
- plan-based team capacity feedback (`free = 0`, `starter = 2`, `premium = 10`)
- incoming invite acceptance now handled by the public `src/app/invite/accept/page.tsx` (moved from the authenticated `(app)` route group so unauthenticated recipients can land on it directly)

### Invite flow

1. Owner/admin creates an invite for an email address
2. Invite row is created with `status = 'pending'`, a unique token, and a copyable `/invite/accept?token=...` link
3. The system attempts to send the invite through Resend and reports returned email errors while keeping the copyable link available
4. The public accept page (`src/app/invite/accept/page.tsx`) is unauthenticated — recipients land on it directly, see their state (loading / auth-required / success / error), and are prompted to log in or create an account if not yet authenticated. The invite URL is preserved through the auth redirect so the accept call fires automatically after login.
5. The invited user can also see pending invites through `GET /api/invites/incoming`
6. The user accepts or declines the invite
7. On accept: a `workspace_members` row is created, active workspace is switched, and invite status becomes `accepted`
8. On decline: invite status becomes `revoked`

### APIs

| Route | Purpose |
| --- | --- |
| `GET /api/workspaces/[id]/members` | List workspace members with profile data |
| `PATCH /api/workspaces/[id]/members/[memberId]` | Update a member's role |
| `DELETE /api/workspaces/[id]/members/[memberId]` | Remove a member from the workspace |
| `POST /api/workspaces/[id]/invites` | Create a pending invite for an email |
| `DELETE /api/workspaces/[id]/invites/[inviteId]` | Revoke a pending invite |
| `GET /api/invites/incoming` | List pending invites for the authenticated user |
| `POST /api/invites/accept` | Accept a pending invite by token |
| `POST /api/invites/decline` | Decline a pending invite by token |

## Data Ownership Model

The system is easier to reason about if each layer has a clear ownership boundary.

### Next.js app owns

- routing
- page rendering
- builder editing experience
- preview chat UI
- API orchestration
- tool/runtime loop
- connection status presentation

### Supabase Postgres owns

- user/workspace records
- agent metadata
- draft definitions and versions
- connection records
- message threads and message history
- run history and observability records
- knowledge source metadata
- knowledge chunks and vector search

### Supabase Storage owns

- raw uploaded knowledge files

### Supabase Edge Functions own

- file-to-text extraction
- chunking
- embedding generation
- semantic retrieval

### OpenRouter owns

- LLM completion behavior
- tool-calling planning decisions
- final response generation

### Composio owns

- connected external app state
- authorization links
- tool execution against third-party services

> ⚠️ **Important:** Composio tool responses have non-obvious envelope shapes that vary between
> integrations. IDs are sometimes integers, arrays are sometimes nested multiple levels deep,
> and `data` fields are sometimes JSON strings. Always read `docs/guides/composio-integrations.md`
> before writing a new tool extractor.

## Database Architecture

The schema is organized into four main domains.

### 1. Identity and workspaces

- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_subscriptions`
- `workspace_invites`

Purpose:

- represent the authenticated user
- define tenant boundaries
- scope all product data to a workspace
- let one operator manage multiple client workspaces
- track subscription plan, billing cycle, and usage limits per workspace
- manage team invites with pending/accepted/revoked lifecycle

### 2. Agents and builder state

- `agents`
- `agent_drafts`
- `agent_versions`

Purpose:

- `agents`: current editable/live agent metadata, including the primary `surface` (`assistant`, `widget`, or `automation`)
- `agent_drafts`: builder draft definition and current graph/config
- `agent_versions`: published snapshots for version history and rollback

Important current behavior:

- the builder edits the current agent and current draft directly
- preview and internal assistant runtime both read from the current agent plus the last saved draft state
- publish creates versioned snapshots, but runtime is not exclusively version-bound
- publish is only required for widget agents; internal assistants become usable after the first normal save and move from `draft` to `active`
- automation agents do not use widget publish; they are activated or paused through the automation trigger lifecycle route

### 3. Connections and runtime conversations

- `connections`
- `agent_connections`
- `chat_threads`
- `messages`
- `runs`
- `run_steps`
- `run_approvals`
- `audit_logs`
- `agent_automations`
- `automation_events`

Purpose:

- `connections`: workspace-level external app connections
- `agent_connections`: which connections a specific agent is allowed to use
- `chat_threads`: conversation containers with a `source` of `preview` or `assistant`
- `messages`: user, assistant, and internal tool messages
- `runs`: one top-level execution per user message
- `run_steps`: detailed runtime trace
- `run_approvals`: approval records retained from the phase 3 schema
- `audit_logs`: coarse event logs
- `agent_automations`: one trigger binding row for an automation agent
- `automation_events`: received external trigger events and their processing state

Important current behavior:

- the customer-facing chat flow no longer pauses for approvals
- approval schema still exists for future internal/governed flows
- internal assistant threads are shared across the workspace and use per-thread active-turn locks
- preview threads remain creator-scoped and are kept separate from assistant threads through `chat_threads.source`
- automation runs do not create chat threads; they store trigger input and execution output directly on `runs` and link provider events through `automation_events.run_id`

### 4. Knowledge base

- `knowledge_sources`
- `knowledge_chunks`
- `knowledge_folders`
- `knowledge_folder_sources`
- `agent_knowledge_sources`
- `agent_knowledge_folders`
- RPC: `match_agent_knowledge_chunks`

Purpose:

- `knowledge_sources`: workspace knowledge library
- `knowledge_chunks`: embedded chunk storage
- `knowledge_folders`: workspace-owned source groups
- `knowledge_folder_sources`: many-to-many folder/source membership
- `agent_knowledge_sources`: directly attached sources for an agent
- `agent_knowledge_folders`: live folder attachments for an agent
- `match_agent_knowledge_chunks`: similarity search scoped to one agent and workspace, including direct sources, ready sources in attached folders, and optional session-scoped widget upload sources

### 4C. Dashboard conversation summaries

- `dashboard_conversation_summaries`

Purpose:

- A materialized summary row per widget session, maintained automatically by Postgres triggers.
- Populated and kept in sync by `private.refresh_dashboard_conversation_summary()` called from three triggers:
  - `refresh_dashboard_conversation_summary_on_session` (on `widget_sessions`)
  - `refresh_dashboard_conversation_summary_on_message` (on `widget_session_messages`)
  - `refresh_dashboard_conversation_summary_on_lead` (on `widget_leads`)
- Fields include: message/lead counts, latest snippet, lead contact info, page URL, referrer, status, and a `search_text` generated column backed by a `gin_trgm_ops` index.
- Only covers `source IN ('embedded', 'hosted')` sessions; preview sessions are excluded.
- Used by the analytics backend to serve paginated conversation lists and search without expensive per-request aggregations.
- RLS mirrors `widget_sessions`: workspace members can select their own workspace rows.

### 4B. Agent library templates

- `agent_library_templates`
- `agent_library_template_sources`

Purpose:

- `agent_library_templates`: submitted reusable agent templates with review status, sanitized builder definition, required integrations, template variables, and source metadata
- `agent_library_template_sources`: snapshotted knowledge content bundled with a template

Important current behavior:

- templates are submitted from saved agent drafts and start in `pending`
- admins review templates from `/admin/verification`
- only `approved` templates are importable from the user-facing Agent Library
- template submission removes workspace-specific connection ids, trigger config, knowledge ids, and account-specific calendar/event-type selections from the stored builder definition
- imported templates create a new draft agent, clone bundled knowledge into the importing workspace, relink the knowledge node to the imported source ids, and resolve `{{variable_name}}` prompt variables before saving instructions
- RLS lets authenticated users read approved templates, their own submissions, and templates from their workspace; privileged admin review uses service-role routes

### 5. Widget deployment and customer conversations

- `widgets`
- `widget_agents`
- `widget_preview_drafts`
- `widget_sessions`
- `widget_session_messages`
- `widget_leads`

Purpose:

- `widgets`: customer-facing widget identity, theme, deployment state, and hosted/embed settings
- `widget_agents`: the ordered set of attached agents plus the snapshotted published version id used at deploy time
- `widget_preview_drafts`: short-lived preview payload snapshots for internal operator preview
- `widget_sessions`: one customer session per widget and session id, including source, completion status, and active-turn lock metadata
- `widget_session_messages`: persisted user, assistant, and tool messages for widget conversations
- `widget_leads`: lead captures submitted through widgets

Important current behavior:

- live widget chat is bound to `widget_agents.published_version_id`, not the current mutable `agents` row
- widget branding and surface configuration still come from the current `widgets` and `widget_agents` rows
- specialist presentation config also comes from the current `widget_agents` row, including:
  - `label`
  - `description`
  - `greeting`
  - `placeholder`
  - `show_quick_actions`
  - `quick_actions`
- deploy status is therefore mixed:
  - chat execution is version-snapshotted
  - visual/config metadata remains live and can drift until redeployed
- `needs_redeploy` is an operator signal used by the app UI, not a hard runtime freeze

## Row-Level Security

RLS is enabled broadly across the application schema.

The architecture assumes:

- users can only access data in workspaces they belong to
- knowledge retrieval is workspace-scoped and agent-scoped
- browser clients use publishable keys and RLS-protected queries
- privileged write paths use server routes or Edge Functions where necessary

Operational note:

- the Edge Functions verify the caller through the forwarded `Authorization` header
- then use the service role only for privileged internal writes such as chunk replacement

### Security definer helper hardening

Supabase security advisor flagged several `SECURITY DEFINER` functions in the exposed `public`
schema as executable by `anon` and `authenticated`. The fix is captured in:

- `supabase/migrations/20260512113836_secure_security_definer_functions.sql`
- `supabase/migrations/20260512114059_tighten_private_helper_function_grants.sql`

The migrations create a non-exposed `private` schema for RLS helper functions:

- `private.is_workspace_member(uuid)`
- `private.can_edit_agent(uuid)`
- `private.workspace_internal_assistants_enabled(uuid)`

RLS policies now call these private helpers instead of the public helper functions. Public
`SECURITY DEFINER` RPCs such as turn-lock helpers, cleanup helpers, subscription bootstrap,
usage incrementing, and the previous public helper copies have execute revoked from `public`,
`anon`, and `authenticated`, with only `service_role` retained where server code still needs
direct RPC access.

After the MCP migration run, the only remaining Supabase security advisor warning was leaked
password protection, which is an Auth dashboard setting and is intentionally not fixed in SQL.

## Route Protection

Middleware is centralized in `src/lib/supabase/proxy.ts`.

Current policy:

- explicitly public routes are listed in `PUBLIC_EXACT_PATHS` and `PUBLIC_PATH_PREFIXES`
- all other middleware-matched routes require a valid Supabase session by default
- public webhook/internal routes must perform their own signature or shared-secret verification
- route classification is covered by `tests/security/middleware-protection.test.ts`

Current explicit public classes include:

- public marketing/legal pages: `/`, `/privacy-policy`, `/terms-of-service`, `/data-processing`, `/subprocessors`
- auth and login flows: `/login/*`, `/auth/*`
- legacy redirect: `/signup` (redirects into the main login flow)
- public widget APIs: `/api/public/*`
- public connection auth-link flow: `/connect/*`
- public workspace invite entry points: `/invite/*`; `/api/invites/*` route handlers still verify the authenticated user where required
- externally called signed/secret-protected endpoints: `/api/billing/webhook`,
  `/api/composio/webhook`, `/api/internal/privacy/retention`

When adding a new unauthenticated route, add it to the public lists deliberately and document the
route-level verification it relies on.

## Agent Model

The core runtime agent model lives in `agents`, `agent_drafts`, and the builder graph definition.

### Agent metadata

Current core agent fields:

- `name`
- `description`
- `status`
- `model`
- `instructions`
- `starter_prompts`

### Builder definition

The builder graph is stored as a `BuilderDefinition` in the draft/version layer.

Current builder node kinds:

- `trigger`
- `agent`
- `knowledge`
- `endchat`
- `gmail`
- `outlook`
- `googlecalendar`
- `cal`

Current agent surfaces:

- `widget`: website chat agent, edited in Builder and tested in Preview
- `automation`: external trigger agent, edited in Builder and inspected in Activity
- `assistant`: internal workspace assistant, edited in Builder and used in the Assistants surface

### Builder constraints

Current canvas rules:

- fixed `Trigger`
- fixed core `Agent`
- optional singleton `Knowledge`
- optional singleton `End Chat`
- optional singleton `Gmail`
- optional singleton `Microsoft Outlook`
- optional singleton `Google Calendar`
- optional singleton `Cal.com`
- no generic tool node
- Google Drive is not a live tool node

## Builder Architecture

The builder page lives at:

- `src/app/(app)/agents/[id]/builder/page.tsx`

### Current editor model

The builder is a configuration surface, not a workflow engine.

The main ideas are:

- the graph shows the agent shape
- the right rail is a selected-node inspector
- the `Agent` node owns core setup
- the `Knowledge` node owns knowledge attachment
- provider-specific tool nodes own connection binding

### Node-specific sidebar behavior

#### Trigger

- fixed entry point
- represents a chat message for website chat agents
- represents an external trigger event for automation agents
- stores generic trigger config in `definition.config.trigger`
- v1 automation trigger support is Composio Gmail new message (`GMAIL_NEW_GMAIL_MESSAGE`)

#### Agent

Owns the main editable agent setup:

- name
- description
- model
- instructions
- starter prompts

#### Knowledge

Owns knowledge source attachment:

- ready sources can be attached
- non-ready sources remain visible but disabled

#### End Chat

Owns conversational completion policy:

- inactivity timeout seconds
- whether the assistant can suggest ending the conversation

Important note:

- `endchat` is a control node, not an external integration
- preview uses it to expose inactivity timeout behavior and assistant completion suggestions
- widget runtime uses it to drive session-completion metadata and completion APIs

#### Gmail

Owns one selected Gmail connection plus a per-node recipient policy.

Current builder/runtime policy:

- the node stores one selected connection
- the node also stores whether Gmail should send to:
  - an AI-chosen recipient from conversation context
  - one hidden fixed internal email
- when a fixed internal email is configured, runtime enforces that recipient server-side and does not trust the model-selected recipient

Default live tool capability is:

- `GMAIL_SEND_EMAIL`
- `GMAIL_REPLY_TO_THREAD`

`GMAIL_REPLY_TO_THREAD` requires `thread_id` and `recipient_email`. Fixed-recipient notification
nodes do not expose thread replies because mixing a source thread with a hidden fixed recipient is
not a safe reply model.

#### Outlook

Owns one selected Microsoft Outlook connection plus a per-node recipient policy.

Current builder/runtime policy:

- the node stores one selected connection
- the node also stores whether Outlook should send to:
  - an AI-chosen recipient from conversation context
  - one hidden fixed internal email
- when a fixed internal email is configured, runtime enforces that recipient server-side and does not trust the model-selected recipient
- the builder UI is structurally identical to the Gmail node

Live tool capability is locked to:

- `OUTLOOK_SEND_EMAIL`

#### Google Calendar

Owns one selected Google Calendar connection plus a per-node booking calendar selection.

Current builder/runtime policy:

- the node stores one selected connection
- the node can also store one selected target calendar as `calendarId`
- the node stores the resolved timezone from the selected booking calendar
- if no explicit booking calendar is selected, the node uses the primary calendar and its resolved timezone when available
- the builder fetches available calendars from the selected connected account through an internal route
- runtime enforces the selected calendar on booking and availability tool calls instead of relying only on prompting
- runtime also injects the resolved calendar timezone into calendar tool calls instead of relying only on prompt guidance

Live tool capability is locked to:

- `GOOGLECALENDAR_CREATE_EVENT`
- `GOOGLECALENDAR_QUICK_ADD`
- `GOOGLECALENDAR_GET_CURRENT_DATE_TIME`
- `GOOGLECALENDAR_FIND_FREE_SLOTS`
- `GOOGLECALENDAR_LIST_CALENDARS`

#### Cal.com

Owns one selected Cal.com connection plus a per-node scheduling configuration.

Current builder/runtime policy:

- the node stores one selected connection (`connectionId`)
- the node stores a scheduling mode: `ai_decides` or `specific_event_type`
- when `specific_event_type` is selected, the node stores the chosen event type id (`eventTypeId`) and its label
- the node stores a resolved booking timezone (`timezone`)
- the builder fetches available event types from the selected connected account through an internal route
- the builder falls back to a manual ID entry field when event types cannot be fetched
- runtime enforces the selected event type on availability and booking tool calls

Event type fetch path:

- `GET /api/connections/cal/event-types?connectionId=<id>`
- calls `listCalEventTypes()` in `src/lib/composio.ts`
- calls `CAL_LIST_EVENT_TYPES` via Composio
- extracts from `result.data.eventTypeGroups[n].eventTypes` (Cal.com v2 shape)
- event type IDs are integers — coerced to strings before use

For the full response shape and extractor implementation details, see `docs/guides/composio-integrations.md`.

Live tool capability is locked to:

- `CAL_GET_AVAILABLE_SLOTS`
- `CAL_CREATE_BOOKING`

### Builder persistence model

Saving the builder updates multiple layers:

- `agents` for current metadata such as `instructions`
- `agent_drafts` for current graph/config state
- `agent_connections` for selected tool-node bindings
- `agent_knowledge_sources` for knowledge attachments

Important current behavior:

- `Preview` does not implicitly save when the user changes tabs
- preview/runtime reads the last saved draft and current durable attachments
- unsaved builder changes remain browser-local until the user saves or publishes
- internal assistants do not appear in `/assistants` until the builder has been saved at least once

## Preview Architecture

The preview page lives at:

- `src/app/(app)/agents/[id]/preview/page.tsx`

### Purpose

Preview is the live test surface for one agent.

It combines:

- conversation UI
- recent run history
- run step traces
- knowledge attachment visibility
- connected tool visibility

### Important current behavior

- raw `tool` role messages are hidden from the visible customer transcript
- they are still persisted for runtime history and debugging
- the visible chat timeline is the customer-facing conversation only
- if the client provides an existing preview `threadId`, the backend now requires that thread to belong to the same agent, workspace, and authenticated creator before it will append messages or runs

This separation is important because the product goal is a frontdesk-style assistant, not a debug console exposed to end users.

## Automation Architecture

For the deeper operational guide, see `docs/guides/automation-agents.md`.

Automation UI lives at:

- `src/app/(app)/agents/[id]/builder/page.tsx`
- `src/app/(app)/agents/[id]/activity/page.tsx`
- `src/components/agents/AgentViewTabs.tsx`
- `src/components/modals/CreateAgentModal.tsx`

Automation backend lives at:

- `src/app/api/agents/[id]/automation/route.ts`
- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/composio/webhook/route.ts`
- `src/lib/automation/executor.ts`

### Product model

Automation is an agent surface, not a separate workflow product.

The v1 builder shape is:

```text
External Trigger -> Agent Core
                   -> Knowledge (optional)
                   -> Connected Tools (optional)
```

Top-level product language should stay provider-neutral:

- `Automation`
- `External Trigger`
- `Trigger`

Provider-specific language such as Gmail belongs inside the selected trigger option and account selector.

### Lifecycle

Automation agents use:

- `Save`
- `Activate Trigger`
- `Pause Trigger`
- `Activity`

They do not use website deploy/publish controls.

Activation and pause are only allowed through:

- `POST /api/agents/[id]/automation/status`

Normal agent status toggles reject `surface = 'automation'`.

### Event processing

The runtime flow is:

```text
Composio trigger webhook
  -> verify webhook signature
  -> insert automation_events
  -> after(() => processAutomationEvent(eventId))
  -> claim event
  -> create runs row
  -> run shared agent runtime with audience = "automation"
  -> persist assistant output, tool messages, knowledge matches, and connected toolkits
  -> mark event processed/failed/ignored
```

The current worker uses `after()` processing. Durable retries, queue leases, and long-running workflow orchestration are intentionally deferred.

### Tool execution

Automation runs use the shared `runAgentChat(...)` runtime. The executor reads the saved builder definition and passes:

- enabled tool actions from `extractEnabledToolsFromDefinition`
- Gmail/Outlook recipient policy
- Google Calendar selected calendar/timezone
- Cal.com selected event type/timezone
- selected knowledge sources through the normal attachment table

This means an automation can use configured Gmail, Outlook, Google Calendar, and Cal.com tool nodes when the trigger payload and agent instructions clearly require action.

Safety remains enforced by runtime policy:

- only selected/attached tool nodes are loaded
- provider-specific argument patchers enforce fixed email recipients and calendar/event-type selections
- automation mode tells the model not to guess missing details and not to claim an external action happened unless a tool call succeeded

### Activity

Automation agents show Builder and Activity tabs.

Activity reads the automation endpoint and presents:

- trigger/account/readiness status
- recent `runs`
- recent `automation_events`
- status and error messages
- output summaries

`/agents/[id]/preview` redirects automation agents to `/agents/[id]/activity`.

## Assistants Architecture

The internal assistant surface lives at:

- `src/app/(app)/assistants/page.tsx`
- `src/app/(app)/assistants/[id]/page.tsx`

### Purpose

Assistants is the authenticated day-to-day chat surface for internal use.

It provides:

- workspace-visible internal assistant discovery
- shared thread lists per assistant
- a clean ChatGPT-style chat interface without preview traces
- assistant-specific editing links for authorized users

### Important current behavior

- only agents with `surface='assistant'` and a non-`draft` status appear here
- internal assistant threads are shared across the workspace
- user messages retain `created_by` and are enriched server-side with sender names
- paused assistants remain readable but reject new messages and new threads

## Conversation Runtime Architecture

The authenticated preview runtime lives in:

- `src/app/api/agents/[id]/chat/route.ts`

The internal assistant runtime lives in:

- `src/app/api/assistants/[id]/chat/route.ts`

These are the main authenticated chat backends in the product.

Current behavior:

- both authenticated chat backends now stream assistant output incrementally instead of waiting for one final buffered response
- preview chat persists against `chat_threads.source = 'preview'`
- internal assistants persist against `chat_threads.source = 'assistant'`
- internal assistants reject overlapping same-thread turns with `409 THREAD_BUSY`
- preview chat currently relies on client-side duplicate-submit prevention instead of the assistant-thread lock RPC

### Runtime inputs

Given:

- an authenticated user
- an agent id
- a message
- optionally a thread id

the route builds one conversational run.

### Runtime sequence

1. Validate auth and request body
2. Load the agent
3. Create a new thread if needed
4. Create a `runs` record
5. Persist the user message
6. Load:
   - message history
   - attached connected tools
   - attached knowledge sources
7. Build model input:
   - base system instructions from `agent.instructions`
   - additional system guidance for available tools
   - additional knowledge context if retrieval returns matches
   - conversation history
8. Resolve allowed tools through Composio
9. Run a multi-step tool loop
10. Persist tool messages
11. Persist the final assistant message
12. Update `runs`, `chat_threads`, and `audit_logs`

The authenticated preview and assistant routes both stream token deltas to the client while this sequence is running, then resync durable state from Postgres at the end of the turn.

### Why the multi-step tool loop matters

This is the key runtime design decision.

The system does not rely on a single model call. Instead it uses a bounded loop:

1. Ask the model for the next step
2. If the model proposes tool calls, execute them
3. Add tool results back into the conversation
4. Ask the model again
5. Continue until the model returns a normal final answer
6. Stop after a maximum iteration count

Current hard limit:

- `MAX_TOOL_ITERATIONS = 6`

This is what makes the runtime suitable for future multi-step agents, not just simple one-shot tool use.

### Final-answer recovery

If the model completes tool work but still does not return a natural-language final answer, the route performs a recovery step:

- it calls the model again without tools
- it asks explicitly for a concise natural-language response
- it prevents raw JSON or tool payloads from being shown to the end user

### Tool guidance

The runtime injects additional system guidance when tools are attached.

Current rules include:

- use tools when the user asks for an action the attached tools can complete
- do not falsely claim inability if a tool exists
- do not return raw JSON or code to the user
- after tool usage, answer in natural language

### Knowledge injection

If attached knowledge sources are ready, the runtime:

1. invokes the `search-knowledge` Edge Function
2. retrieves vector matches scoped to the current agent
3. builds a system knowledge block
4. injects it into the model prompt

Knowledge retrieval is treated as runtime context, not as a user-visible tool.

### Run observability

Each run creates step-level observability via:

- `runs`
- `run_steps`
- `audit_logs`
- `automation_events`
- `agent_automations`

The preview screen uses this data for inspection and debugging.

### End-chat behavior

The runtime also supports a conversational completion policy derived from the builder definition.

Current behavior:

- the preview/authenticated chat route inspects the saved draft definition for the `endchat` node
- the same saved draft definition is also inspected for Gmail recipient policy and Google Calendar calendar selection
- assistant completion is surfaced through runtime metadata produced by an internal pseudo-tool flow
- preview inactivity timeout behavior is coordinated by the preview UI, not by the authenticated chat route itself
- widget conversations use dedicated session completion handling through the public widget runtime

This means end-chat is shared product behavior, but not enforced by one single route in exactly the same way across preview and widget chat.

## Widget Deployment and Public Runtime

The widget system is now a first-class part of this repo.

The product surface is split into:

- internal widget management UI under `/widgets`
- a public runtime delivered by `apps/widget-v2`
- public widget APIs hosted by this Next.js app under `/api/public/widgets/[widgetPublicKey]/*`

### Internal widget management

The authenticated app owns:

- widget list and detail screens
### Widget Deployment & "Needs Sync"

The widget has a two-stage lifecycle: `draft` and `deployed`.

- **Draft:** Changes are saved to the database but not reflected in the live widget.
- **Deployed:** Changes are officially "pushed" to the live widget, and a snapshot of the current agent versions is taken.

#### Redeployment Logic (`needs_redeploy`)

A widget enters the "Needs Sync" state when:
1. The widget's own configuration (colors, branding, title, etc.) has been updated since the last deployment.
2. Any of the attached agents have been updated or had a new version published since the last deployment.

#### Syncing Changes

To resolve the "Needs Sync" state, the operator must click the **Sync Changes** button in the widget builder. This:
1. Re-snapshots the currently attached agents with their latest published versions.
2. Updates the `deployed_at` timestamp on the widget.
3. Makes all pending configuration changes live.

This separation ensures that live widgets remain stable even while the operator is actively editing their configuration or specialists.

### Deployment status and redeploy logic
- attached-agent ordering and configuration
- hosted access toggle
- preview drafting and preview URLs
- embed snippet and hosted-link operator surfaces

Important current behavior:

- widget management is no longer centered inside `/agents/[id]/builder`
- the legacy agent-widget route redirects into `/widgets?agent=...`
- a widget can attach multiple agents and can require a specific `widgetAgentId` at runtime when more than one is attached
- hosted standalone runtime routes now use a dedicated desktop shell on large breakpoints instead of reusing the old narrow mobile-card proportions

### Public runtime contract

The public runtime uses these endpoints:

- `GET /api/public/widgets/[widgetPublicKey]/bootstrap`
- `GET /api/public/widgets/[widgetPublicKey]/config`
- `POST /api/public/widgets/[widgetPublicKey]/chat`
- `POST /api/public/widgets/[widgetPublicKey]/complete`
- `POST /api/public/widgets/[widgetPublicKey]/events`
- `POST /api/public/widgets/[widgetPublicKey]/leads`
- `POST /api/public/widgets/[widgetPublicKey]/upload`

### Access and security model

The public widget runtime is a public browser embed, not a customer-backend integration.

Current behavior:

- bootstrap validates whether the request is hosted or embedded
- bootstrap responses are returned with `Cache-Control: no-store`
- hosted mode is allowed only when `widget.hosted_enabled` is true
- embedded mode requires a normalized `Origin` match against `widget.allowed_origins`
- `allowed_origins` is treated as a soft abuse-control for copy-paste installs, not a hard authentication boundary against scripted clients
- runtime endpoints only allow widget-runtime origins and no longer emit credentialed wildcard CORS responses
- bootstrap returns a short-lived signed widget access token for subsequent runtime requests; customers do not mint this token themselves
- hosted and embedded widget clients both retry one bootstrap refresh automatically on `WIDGET_ACCESS_TOKEN_INVALID`
- public widget POST endpoints rate-limit by trusted edge headers only (`x-vercel-forwarded-for` and `cf-connecting-ip`); requests without a trusted header fall back to the shared `"unknown"` bucket
- public widget and related runtime APIs now return stable client-safe errors while full exception detail remains server-side in logs
- the dashboard app sends baseline browser protections through CSP, HSTS, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`
- dashboard CSP includes Supabase origins only when `NEXT_PUBLIC_SUPABASE_URL` is configured
- widget appearance is configured through theme mode plus primary and secondary accent colors; base surfaces/text are derived in the runtime
- preview mode uses a different signed preview token flow
- the widget runtime shows a lightweight first-message consent gate before the first real chat turn and links it to the public `/privacy-policy` route
- consent is currently remembered client-side per widget public key so returning visitors are not blocked on every new session
- widget session/activity data, widget messages, and widget leads are currently covered by a 180 day retention policy enforced by an internal purge route
- public widget POST endpoints now enforce volumetric rate limiting for hosted and embedded traffic
- preview-token traffic is intentionally excluded from the public widget rate limiter, but widget preview chat still consumes workspace message credits before model execution
- the rate-limit RPC must upsert with `ON CONFLICT ON CONSTRAINT rate_limit_windows_scope_window_constraint`; using a bare column-list conflict target can reintroduce ambiguous `window_started_at` failures in Postgres
- self-service password reset is implemented through `/login/forgot-password` and authenticated Settings; backup/restore and deploy verification are documented in `docs/runbooks/operations.md`
- file uploads support images and documents (up to 5MB) via the public `upload` endpoint and are stored securely in the `widget-attachments` storage bucket
- PDF and text uploads create ephemeral `knowledge_sources` rows scoped by the internal `widget_sessions.id` UUID; the foreign key cascades those sources when the session is deleted

Important token rules:

- widget access tokens are short-lived and the runtime refreshes them once on expiry
- preview tokens are short-lived
- both currently use a 15 minute TTL

### Deployment model

Current deployment behavior is intentionally mixed:

- live widget chat executes against the `published_version_id` snapshotted into each `widget_agent`
- public config and branding still come from the current `widgets` and `widget_agents` rows
- `needs_redeploy` is used to tell operators when the current widget config has drifted from the last deployment event
- the public widget frontend is deployed separately from the Next.js dashboard app, so `apps/widget-v2` changes require their own widget-runtime deploy before `widget.agentergroup.com` updates

This is not a fully immutable deployment model, but it prevents live widget chat from silently running an unpublished agent version.

### Preview model

Widget preview uses:

- draft preview payloads
- persisted preview-draft rows
- signed preview tokens

Preview requests can resolve runtime config without deploying the widget publicly. The preview token only changes access and rate-limit behavior: it lets the operator load draft config and bypass public anonymous volumetric limits. Chat turns still use `/api/public/widgets/[widgetPublicKey]/chat`, still call `consumeWorkspaceMessageUsage()`, and still stop with `402 MESSAGE_LIMIT_REACHED` when the workspace allowance is exhausted.

### Widget session lifecycle

The public runtime persists customer interaction through:

- `widget_sessions`
- `widget_session_messages`
- `widget_leads`

Current behavior:

- chat requests create or update widget sessions
- widget sessions store `active_turn_request_id` and `active_turn_started_at` to serialize live turns
- public chat acquires a per-session turn lock before running agent/tool work
- overlapping turns for the same session are rejected with `409 SESSION_BUSY` instead of being queued
- customer-facing public widget chat, events, completion, and lead submission routes are also protected by dedicated rate limits with `429` responses and `Retry-After`; signed preview-token chat is excluded from those public rate limits but remains credit-metered
- user, assistant, and tool messages are persisted
- lead submissions are stored against the active widget session where possible and the public response is intentionally minimized to `leadId` plus `createdAt`
- session completion can happen through explicit public completion calls, including inactivity-timeout completion
- widget chat streams token deltas over SSE and client-triggered aborts are propagated through the server runtime to the upstream model request
- terminal SSE failures now emit a generic client-safe error payload instead of raw exception text

## Analytics Architecture

Analytics is a workspace-level operations surface focused on widget conversations.

Main surfaces:

- `/analytics`
- `/dashboard` (new home page with summary stats and recent activity)
- `GET /api/dashboard/analytics`
- `GET /api/dashboard/analytics/conversations/[widgetSessionId]`
- `GET /api/dashboard/summary` (returns workspace stats for the dashboard home)

Current behavior:

- analytics is built from widget session, message, lead, and failure data
- the primary UI is split between a chat/inbox view and a KPI overview view
- analytics excludes preview sessions and focuses on customer-facing widget traffic
- production does not persist raw tool debug payloads into stored assistant/widget traces
- conversation-detail `debugTrace` remains available only to workspace owners and admins

### Dashboard summary

`src/lib/dashboard/summary.ts` is the server-side loader for the `/dashboard` home page.

It loads in parallel:
- recent widget conversations (last 30 days, max 4) from `listRecentDashboardConversations()`
- active (non-archived) agents for the workspace
- widget count and deployed widget count
- connected app count
- knowledge source count
- widget lead count

The dashboard home page renders stats cards, an agent status list, and a recent conversations activity panel.

## OpenRouter Integration

OpenRouter integration lives in:

- `src/lib/openrouter.ts`

### Responsibility

This module is a thin transport wrapper around:

- `https://openrouter.ai/api/v1/chat/completions`

### Current behavior

It sends:

- `model`
- `messages`
- `tools` when tools are available
- `tool_choice: "auto"` when tools are present
- `provider.data_collection = "deny"` by default on every request
- `provider.zdr = true` by default on every request unless explicitly disabled via env

Important note:

- OpenRouter is currently the only LLM transport layer
- the model can be configured per agent, but the transport path is centralized
- request-level privacy enforcement now lives in code, not only in OpenRouter dashboard settings
- all current model entry points consume workspace message quota before invoking OpenRouter

## Composio Architecture

Composio integration lives in:

- `src/lib/composio.ts`
- `src/lib/integrations.ts`

### Supported integrations

The product-owned integration catalog currently allows only:

- `gmail`
- `outlook`
- `slack`
- `hubspot`
- `shopify`
- `googleads`
- `googlecalendar`
- `cal`
- `googledrive`

This is intentionally narrow. Unsupported marketplace-style integrations are not part of the current product surface.

### Current tool policy

#### Automation trigger integration

- Gmail
  - `GMAIL_NEW_GMAIL_MESSAGE`
  - consumed through `https://dashboard.agentergroup.com/api/composio/webhook`
  - activates `surface = 'automation'` agents through `agent_automations`
  - stores incoming events in `automation_events`
  - runs the shared agent runtime with configured tools and knowledge

#### Chat-capable integrations

- Gmail
  - `GMAIL_SEND_EMAIL`
  - `GMAIL_REPLY_TO_THREAD`
- Microsoft Outlook
  - `OUTLOOK_SEND_EMAIL`
- Slack
  - `SLACK_SEND_MESSAGE`
  - `SLACK_SEARCH_MESSAGES`
  - `SLACK_FETCH_CONVERSATION_HISTORY`
  - `SLACK_FIND_CHANNELS`
  - `SLACK_FIND_USERS`
- HubSpot
  - contact, company, deal, ticket, note, and task actions selected from the shared action picker
- Shopify
  - shop, product, customer, order, draft order, and inventory actions selected from the shared action picker
- Google Ads
  - `GOOGLEADS_LIST_ACCESSIBLE_CUSTOMERS`
  - `GOOGLEADS_GET_CAMPAIGN_BY_ID`
  - `GOOGLEADS_GET_CAMPAIGN_BY_NAME`
  - `GOOGLEADS_GET_CUSTOMER_LISTS`
  - `GOOGLEADS_SEARCH_STREAM_GAQL`
- Google Calendar
  - `GOOGLECALENDAR_CREATE_EVENT`
  - `GOOGLECALENDAR_QUICK_ADD`
  - `GOOGLECALENDAR_GET_CURRENT_DATE_TIME`
  - `GOOGLECALENDAR_FIND_FREE_SLOTS`
  - `GOOGLECALENDAR_LIST_CALENDARS`
- Cal.com
  - `CAL_GET_AVAILABLE_SLOTS`
  - `CAL_CREATE_BOOKING`

#### Knowledge-only integration

- Google Drive
  - not available as a live customer chat tool
  - used only to import files into the Supabase knowledge base

### Session model

The current implementation creates Composio tool-router sessions per user.

Important operational detail:

- tool-router, Composio SDK session, and MCP session references are cached in memory inside the Next.js server process
- all three cache maps carry a `createdAt` timestamp and use a 30-minute TTL
- this improves repeated use during a session
- it is not durable across deploys or cold starts

This is acceptable for the current MVP, but it is still process-local best-effort caching. It should
not be treated as durable cross-instance state on serverless infrastructure.

### Toolkit versioning

The current Composio SDK requires explicit toolkit versions for manual `tools.execute(...)` calls.

This matters because the app uses two different Composio patterns:

- session-backed tool routing for live agent and widget chat
- direct manual tool execution for utility surfaces such as:
  - Google Calendar list loading in the builder
  - Google Drive file listing
  - Google Drive metadata and download helpers

To keep this stable, the app configures toolkit versions centrally when the Composio client is created in `src/lib/composio.ts`.

Current defaults are defined for:

- `gmail`
- `outlook`
- `slack`
- `hubspot`
- `shopify`
- `googleads`
- `googlecalendar`
- `cal`
- `googledrive`
- `text_to_pdf`

These defaults can be overridden with environment variables:

- `COMPOSIO_TOOLKIT_VERSION_GMAIL`
- `COMPOSIO_TOOLKIT_VERSION_OUTLOOK`
- `COMPOSIO_TOOLKIT_VERSION_SLACK`
- `COMPOSIO_TOOLKIT_VERSION_HUBSPOT`
- `COMPOSIO_TOOLKIT_VERSION_SHOPIFY`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEADS`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
- `COMPOSIO_TOOLKIT_VERSION_CAL`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`
- `COMPOSIO_TOOLKIT_VERSION_TEXT_TO_PDF`

The app does not pass toolkit versions ad hoc on each manual execution call.

### Connection sync

The app does not treat Composio as the only source of truth for UI state.

Instead it:

1. lists connected accounts from Composio
2. normalizes them
3. syncs them into the `connections` table

The Composio identity is now scoped to the workspace runtime, not the raw auth user id.
That means each workspace has its own external connection surface even if the same human belongs to multiple workspaces.

This allows the app to:

- render connection state consistently
- attach specific connections to agents
- keep UI and runtime selection inside the app database

## Connections Architecture

### Main UI

- `src/app/(app)/connections/page.tsx`

### APIs

- `src/app/api/connections/toolkits/route.ts`
- `src/app/api/connections/authorize/route.ts`
- `src/app/api/connections/disconnect/route.ts`
- `src/app/api/connections/googlecalendar/calendars/route.ts`

### Current behavior

The Connections page is a fixed product surface, not an open integration marketplace.

It shows only:

- Gmail
- Microsoft Outlook
- Slack
- HubSpot
- Shopify
- Google Ads
- Google Calendar
- Cal.com
- Google Drive

Each integration card shows:

- connection state
- purpose in the product
- connect or reconnect action

### Authorization flow

Current flow:

1. user chooses one of the supported integrations
2. backend validates the integration slug against the catalog
3. backend asks Composio for an authorization session
4. backend creates or reuses the toolkit auth config, links the connected account flow, and upserts a `connections` row as pending
5. user completes external provider auth
6. app later syncs the connected account into `connections`

Important runtime rule:

- connected accounts are keyed to the workspace-scoped Composio identity
- stale legacy rows without the expected scoped identity are treated as disconnected until reconnected
- previously synced Composio rows whose `external_id` no longer exists upstream are downgraded to `disconnected` on the next sync instead of being left as false-positive connected rows
- most toolkits use Composio managed auth
- Shopify does not have Composio managed auth; it requires either a real `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID`/`COMPOSIO_AUTH_CONFIG_SHOPIFY` or Shopify OAuth credentials so `createConnectionRequest()` can create a `use_custom_auth` OAuth2 auth config
- invalid placeholder auth config IDs such as `ac_...` are ignored, and auth config overrides are injected only when starting a connection request so `/connections` can still load even if optional Shopify setup is absent

### External connection auth links

Workspace owners and admins can create a one-integration auth link from the Connections page.
The link is intended for agency/customer workflows where another person needs to authorize
their own Gmail, Slack, HubSpot, Shopify, or other supported provider account without receiving
Agentergroup workspace access.

The `connection_auth_links` table stores only a SHA-256 `token_hash`; the raw bearer token is
shown once in the generated `/connect/[token]` URL. Links default to a 7-day expiry and can be
`pending`, `completed`, or `revoked`.

Public flow:

1. recipient opens `/connect/[token]`
2. public API validates the hashed token, pending status, expiry, supported toolkit, and integration access
3. backend creates a Composio connection request for `workspace:<workspaceId>` with a callback URL
4. backend upserts the workspace `connections` row as `pending`, using the link creator as `created_by`
5. recipient completes provider auth
6. `/connect/callback` syncs Composio connected accounts into `connections`
7. callback marks the auth link `completed` when a connected row for the toolkit exists

Expired, revoked, and completed links cannot start a new provider auth flow. The resulting
connection belongs to the workspace, not to the external recipient as an Agentergroup user.

### Google Calendar selector flow

The Google Calendar node in the builder supports choosing a specific booking calendar per node.

Current flow:

1. the builder loads chat-tool connection state from `GET /api/connections/toolkits`
2. the operator selects a connected Google Calendar account
3. the builder calls `GET /api/connections/googlecalendar/calendars`
4. the route performs a best-effort connection sync from Composio and marks previously synced missing accounts as disconnected
5. the route resolves the Composio connected account id from the stored connection row
6. the route executes `GOOGLECALENDAR_LIST_CALENDARS`
7. the returned calendars populate the node-level booking-calendar selector and expose each calendar's timezone when available
8. if the connected account has been deleted in Composio between syncs, the route downgrades the row to `disconnected` and returns a reconnect-required error instead of a 500
9. the selected booking calendar becomes the source of truth for Google Calendar scheduling timezone

This flow depends on the centralized Composio toolkit-version configuration described above.

## Knowledge Base Architecture

The knowledge system is a workspace-level library backed by Supabase Postgres + `pgvector`.

### Source types

Current supported source types:

- pasted text (previewable and editable)
- uploaded files (previewable)
- Google Drive imported files (previewable)
- website scraping via Firecrawl (previewable and editable as markdown)
  - **Single Page Scrape**: Available to all users.
  - **Multi-page Crawl**: Up to 30 pages (Premium Only).
  - **Sitemap Selection**: Interactive page discovery and picking (Premium Only).

### Supported file formats

Current supported knowledge file types:

- `.txt`
- `.md`
- `.pdf`
- website URLs (converted to markdown)
  - Support for domain-only input (e.g., `example.com` automatically prepends `https://`)

### Website Scraping & Discovery

The platform uses **Firecrawl** to ingest website content.

#### Discovery (Mapping)
For premium users, the system can "map" a website to find all public URLs.
- **Route**: `POST /api/knowledge/sources/map`
- **Behavior**: Uses Firecrawl's `map` feature to return a list of discovered URLs.
- **UI**: Users can search and select up to 30 specific pages to ingest.

#### Ingestion (Scraping/Crawling)
- **Route**: `POST /api/knowledge/sources`
- **Single Page Mode**: Default behavior. Only the primary URL provided is ingested. The UI displays a "Single Page Mode" badge to confirm this.
- **Selection Mode**: Activated via "Find Pages" (Premium Only). Allows discovery and manual selection of up to 30 specific URLs. The UI displays a "Selection Mode" badge and a list of discovered pages. The system scrapes only these targeted URLs and joins them into a single knowledge source.

### Supported MIME types

- `text/plain`
- `text/markdown`
- `application/pdf`

Google Docs, Sheets, Slides, images, and general binaries are not part of the current supported import surface.

### Storage architecture

#### Postgres

- `knowledge_sources`
- `knowledge_chunks`
- `knowledge_folders`
- `knowledge_folder_sources`
- `agent_knowledge_sources`
- `agent_knowledge_folders`

#### Storage

- bucket: `knowledge-files`
- bucket: `widget-attachments`

Storage only holds raw files. Retrieval never reads directly from Storage at chat time.

### Why the knowledge base is Supabase-native

The runtime does not treat Google Drive or external websites as live retrieval backends.

Instead:

1. External source is imported:
   - Drive file is downloaded
   - Website is scraped and converted to markdown using Firecrawl
2. content is stored:
   - Files are stored in Supabase Storage
   - Website/Text content is stored in the `raw_text` column of `knowledge_sources`
3. content is processed into chunks and embeddings
4. the agent retrieves from Supabase vector search during chat

This is the right separation because it keeps retrieval:

- fast
- workspace-scoped
- deterministic
- independent from third-party file or scraping APIs at answer time

## Knowledge Processing Pipeline

### Main processing function

- `supabase/functions/process-knowledge-source/index.ts`

### Shared helpers

- `supabase/functions/_shared/knowledge.ts`

### Processing sequence

1. Verify caller auth from `Authorization` header
2. Load knowledge source
3. Extract raw text:
   - If it is a file source, download from Supabase Storage and extract text
   - If it is a text or website source, use the `raw_text` from the database
4. Normalize text
5. Chunk text
6. Generate embeddings with `Supabase.ai.Session("gte-small")`
7. Replace all existing chunks for the source
8. Update source status and chunk count

### Embedding model

Current embedding model:

- `gte-small`

Current embedding behavior:

- mean pooling
- normalized embeddings

### Chunking behavior

Chunking is paragraph-aware and deterministic.

The shared chunker targets:

- target chunk size around 1200 characters
- overlap around 200 characters
- minimum useful content threshold

### Failure model

If processing fails:

- source status becomes `failed`
- `error_message` is written to the source row
- no partial success is silently accepted

## Knowledge Retrieval Pipeline

### Search function

- `supabase/functions/search-knowledge/index.ts`

### Search behavior

1. Verify caller auth
2. Embed the incoming user query with `gte-small`
3. Call RPC `match_agent_knowledge_chunks`
4. Return the top semantic matches

The RPC resolves eligible sources from direct `agent_knowledge_sources` rows plus ready sources
currently inside folders attached through `agent_knowledge_folders`. Widget runtime calls can also
pass an internal widget-session UUID to include ephemeral PDF/text uploads for that session.
Duplicate source eligibility is deduped before chunk matching.

### Retrieval settings

Current defaults:

- threshold: `0.7`
- count: `8`

### Runtime prompt injection

Matches are converted into a knowledge context block and inserted as a system message.

The runtime guidance says:

- use knowledge excerpts when relevant
- prefer them over guessing
- if insufficient, say so plainly

### Citations

The final assistant message stores knowledge citation metadata in `messages.metadata.knowledgeMatches`.

The preview page uses this to show which sources informed the answer.

## Google Drive Knowledge Import

### User flow

1. User connects Google Drive in Connections
2. User opens `/knowledge`
3. If multiple Drive accounts exist, user selects the target Drive connection first
4. User browses Drive-importable files for that exact connection
5. User chooses a supported file
6. Backend downloads the file through Composio using the selected connected account id
7. Backend creates a `knowledge_sources` row
8. Backend uploads the raw file to Supabase Storage
9. Backend invokes `process-knowledge-source`
10. Source becomes a normal Supabase-backed knowledge source

Download hardening:

- the backend accepts inline content directly
- remote file fetches are restricted to vetted `http/https` object-download hosts
- DNS resolution happens before fetch and blocks private, loopback, and link-local destinations
- redirect destinations are re-validated against the same rules
- local file-path reads and arbitrary remote URLs are rejected

### Important architectural rule

Google Drive is an import source only.

It is not:

- a live chat tool
- a runtime retrieval system
- a special-case data source once imported

After import, the source behaves like any other workspace knowledge source.

## API Inventory

### Agent APIs

| Route | Purpose |
| --- | --- |
| `POST /api/agents/[id]/chat` | Main conversational runtime |
| `GET /api/agents/[id]/knowledge` | Load agent knowledge attachments |
| `POST /api/agents/[id]/knowledge` | Replace knowledge attachments |
| `GET /api/agents/[id]/automation` | Load automation definition, trigger binding, readiness, events, runs, and available trigger accounts |
| `PUT /api/agents/[id]/automation` | Save or update the automation trigger binding while keeping activation separate |
| `DELETE /api/agents/[id]/automation` | Delete the automation trigger binding and upstream provider trigger if present |
| `POST /api/agents/[id]/automation/status` | Activate or pause an automation trigger; the only route allowed to turn automation triggers on or off |
| `POST /api/agents/[id]/archive` | Archive an agent |
| `POST /api/agents/[id]/rollback` | Roll back to a prior version |
| `POST /api/agents/[id]/status` | Activate/pause normal agents; rejects automation agents |
| `GET /api/agents/[id]/widget` | Legacy moved response pointing callers to `/widgets?agent=...` |
| `POST /api/agents/[id]/widget` | Legacy moved response pointing callers to `/widgets?agent=...` |

### Agent Library APIs

| Route | Purpose |
| --- | --- |
| `GET /api/agent-library` | List approved templates for authenticated users |
| `GET /api/agent-library/submissions` | List templates submitted from the active workspace |
| `POST /api/agent-library/submit` | Snapshot a saved agent definition and selected knowledge for admin review |
| `POST /api/agent-library/[id]/import` | Import an approved template into the active workspace |
| `GET /api/admin/agent-library` | Admin list of all submitted templates |
| `POST /api/admin/agent-library/[id]/review` | Approve or reject a submitted template |
| `DELETE /api/admin/agent-library/[id]` | Permanently remove a template and cascade-delete its bundled knowledge snapshots |

### Composio webhook APIs

| Route | Purpose |
| --- | --- |
| `POST /api/composio/webhook` | Verify Composio webhooks, ingest automation trigger events, and handle connected-account expiry events |

### Billing APIs

| Route | Purpose |
| --- | --- |
| `POST /api/billing/checkout` | Start Stripe subscription checkout for a workspace plan change |
| `POST /api/billing/extra-credits/checkout` | Start one-time Stripe checkout for the 500-message extra credit pack |
| `GET /api/billing/invoices` | List Stripe invoices for the active workspace billing customer |
| `POST /api/billing/portal` | Create a Stripe billing portal session for payment method and subscription management |
| `POST /api/billing/webhook` | Process Stripe subscription and extra credit checkout events |

### Connection APIs

| Route | Purpose |
| --- | --- |
| `GET /api/connections/toolkits` | Return supported integrations and merged connection status |
| `POST /api/connections/authorize` | Start Composio authorization for one allowed integration |
| `GET /api/connections/auth-links` | List recent one-integration external auth links for the active workspace; owner/admin only |
| `POST /api/connections/auth-links` | Create a hashed, 7-day external auth link for one supported integration; owner/admin and integrations-enabled workspaces only |
| `POST /api/connections/auth-links/[id]/revoke` | Revoke a pending external auth link |
| `POST /api/public/connection-auth-links/[token]/start` | Public no-login endpoint that validates a bearer link and starts provider auth |
| `POST /api/connections/disconnect` | Remove a local connection row, best-effort delete the upstream Composio connected account, and pause/error active automations using that connection |
| `GET /api/connections/googlecalendar/calendars` | List selectable calendars for one connected Google Calendar account in the builder |

### Health API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Public no-store process availability check; does not inspect external dependencies or expose credentials |

### Workspace APIs

| Route | Purpose |
| --- | --- |
| `GET /api/workspaces` | Return the active workspace id and all accessible workspaces |
| `POST /api/workspaces` | Create a new owner workspace and make it active |
| `POST /api/workspaces/active` | Switch the active workspace for the current session |
| `DELETE /api/workspaces/[id]` | Permanently delete an owned workspace, verify the delete actually happened, and move the active cookie to another workspace |
| `POST /api/workspaces/[id]/privacy/dsar/lookup` | Owner-only subject-data preview for public widget records |
| `POST /api/workspaces/[id]/privacy/dsar/export` | Owner-only JSON export for public widget subject data with sanitized export filename tokens |
| `POST /api/workspaces/[id]/privacy/dsar/delete` | Owner-only subject-data deletion for public widget records |

### Internal privacy APIs

| Route | Purpose |
| --- | --- |
| `POST /api/internal/privacy/retention` | Secret-protected retention purge for expired widget sessions, messages, and leads |

### Knowledge APIs

| Route | Purpose |
| --- | --- |
| `GET /api/knowledge/sources` | List workspace knowledge sources |
| `POST /api/knowledge/sources` | Create a text source, scrape a website, or reserve file source upload |
| `DELETE /api/knowledge/sources/[id]` | Delete a source and associated file/chunks |
| `POST /api/knowledge/sources/[id]/process` | Reprocess an existing source |
| `GET /api/knowledge/folders` | List workspace knowledge folders and source membership |
| `POST /api/knowledge/folders` | Create a folder and optional source membership |
| `PATCH /api/knowledge/folders/[id]` | Rename, describe, or replace source membership for a folder |
| `DELETE /api/knowledge/folders/[id]` | Delete a folder and links without deleting sources |
| `GET /api/knowledge/drive/files` | List importable Google Drive files for a selected connected account |
| `POST /api/knowledge/drive/import` | Import a supported Drive file into the knowledge base from a selected connected account |

### Widget management APIs

| Route | Purpose |
| --- | --- |
| `GET /api/widgets` | List widgets for the active workspace |
| `POST /api/widgets` | Create a new widget, optionally seeded from an agent context |
| `GET /api/widgets/[id]` | Load widget detail, attached agents, runtime summary, and available agents |
| `PATCH /api/widgets/[id]` | Update widget identity, theming, access, and settings |
| `DELETE /api/widgets/[id]` | Permanently delete a widget |
| `POST /api/widgets/[id]/agents` | Replace the widget's attached agents and persist their runtime-facing specialist config |
| `POST /api/widgets/[id]/deploy` | Deploy the widget and snapshot attached published agent versions |
| `POST /api/widgets/[id]/status` | Toggle deployment state between `draft` and `deployed` |
| `POST /api/widgets/[id]/preview` | Create/update a preview draft and return preview access data |

### Public widget runtime APIs

| Route | Purpose |
| --- | --- |
| `GET /api/public/widgets/[widgetPublicKey]/bootstrap` | Validate runtime access, return config bootstrap, and issue widget access token |
| `GET /api/public/widgets/[widgetPublicKey]/config` | Return current public widget runtime config |
| `POST /api/public/widgets/[widgetPublicKey]/chat` | Process a widget chat message, reject overlapping same-session turns with `409 SESSION_BUSY`, consume workspace message credits before model execution, and rate-limit abusive hosted/embed traffic with `429`; signed preview-token chat skips public rate limits but remains credit-metered |
| `POST /api/public/widgets/[widgetPublicKey]/complete` | Mark a widget session completed, currently for inactivity timeout, refuse completion while a live turn is active, and apply public runtime rate limits backed by the named `rate_limit_windows_scope_window_constraint` upsert path |
| `POST /api/public/widgets/[widgetPublicKey]/events` | Persist widget client events under public runtime rate limits without surfacing SQL ambiguity errors from the rate-limit RPC |
| `POST /api/public/widgets/[widgetPublicKey]/leads` | Persist a lead submission from the widget under public runtime rate limits and return a minimal success payload |
| `POST /api/public/widgets/[widgetPublicKey]/upload` | Upload an image or document; PDF/text files are indexed as session-scoped knowledge using the internal widget-session UUID |

### Analytics APIs

| Route | Purpose |
| --- | --- |
| `GET /api/dashboard/analytics` | Return workspace analytics overview, filters, and paginated conversation inbox data |
| `GET /api/dashboard/analytics/conversations/[widgetSessionId]` | Return one widget conversation detail transcript, lead info, and role-gated debug metadata |

## Environment Variables

The core environment contract is:

### Public/browser-visible

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WIDGET_APP_URL`
- `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID`

### Server-only

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_DATA_COLLECTION`
- `OPENROUTER_REQUIRE_ZDR`
- `FIRECRAWL_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `COMPOSIO_API_KEY`
- `COMPOSIO_WEBHOOK_SECRET`
- `COMPOSIO_TOOLKIT_VERSION_GMAIL`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
- `COMPOSIO_TOOLKIT_VERSION_CAL`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`
- `COMPOSIO_TOOLKIT_VERSION_OUTLOOK`
- `COMPOSIO_TOOLKIT_VERSION_SLACK`
- `COMPOSIO_TOOLKIT_VERSION_HUBSPOT`
- `COMPOSIO_TOOLKIT_VERSION_SHOPIFY`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEADS`
- `COMPOSIO_TOOLKIT_VERSION_TEXT_TO_PDF`
- `COMPOSIO_GOOGLEADS_AUTH_CONFIG_ID` (optional real Composio auth config id)
- `COMPOSIO_AUTH_CONFIG_GOOGLEADS` (optional alternate auth config id name)
- `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID` (optional real Composio auth config id)
- `COMPOSIO_AUTH_CONFIG_SHOPIFY` (optional alternate auth config id name)
- `COMPOSIO_SHOPIFY_CLIENT_ID` (required if no auth config id is provided)
- `COMPOSIO_SHOPIFY_CLIENT_SECRET` (required if no auth config id is provided)
- `COMPOSIO_SHOPIFY_OAUTH_REDIRECT_URI`
- `COMPOSIO_SHOPIFY_SCOPES` (optional)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_EXTRA_CREDITS_500_PRICE_ID`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WIDGET_APP_URL`
- `WIDGET_ACCESS_SECRET`
- `WIDGET_PREVIEW_SECRET`
- `RATE_LIMIT_SECRET`
- `GDPR_RETENTION_CRON_SECRET`

Billing and rate-limit env rules:

- Stripe helpers in `src/lib/stripe.ts` are import-safe, but billing routes return `503` when required Stripe env is missing.
- `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` and `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` are required for plan checkout and webhook price-to-plan mapping; there are no hardcoded price id fallbacks.
- `STRIPE_EXTRA_CREDITS_500_PRICE_ID` is required for the 500-message extra credit checkout.
- `RATE_LIMIT_SECRET` must be a dedicated production secret. It can fall back to `WIDGET_ACCESS_SECRET`, but it never falls back to `SUPABASE_SERVICE_ROLE_KEY`.

### Supabase Edge Functions

Expected inside Supabase function runtime:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` or legacy `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`

The knowledge Edge Functions accept current `sb_secret_...` keys through
the `apikey` header. Because those keys are not JWTs, `search-knowledge`
and `process-knowledge-source` run with `verify_jwt = false` and perform
their own internal-key or user-token authorization in the handler.

## Observability and Debugging

### Primary runtime records

- `runs`
- `run_steps`
- `audit_logs`

### What these are for

- `runs`: high-level execution record
- `run_steps`: fine-grained runtime trace
- `audit_logs`: event log useful for operator context
- `automation_events`: provider event ingestion and processing status
- `agent_automations`: current automation trigger binding, status, provider trigger id, and last error

### Preview as operator surface

The preview UI doubles as:

- a test environment
- a runtime debugger

This is why it shows:

- recent runs
- steps
- approvals table data if present
- attached knowledge and tools

while still keeping the end-user transcript clean.

### Activity as automation operator surface

The Activity UI is the automation debugger.

It shows:

- recent automation runs
- recent trigger events
- run/event statuses
- output summaries
- provider trigger/account readiness
- last automation error

## Current Constraints and Intentional Simplifications

These are not bugs. They are current architectural decisions.

### 1. Builder is a configuration editor, not a workflow engine

The graph is intentionally limited. There are no condition nodes, loops, schedules, or approval branches in the active product flow. Automation v1 has external trigger execution, but the builder graph is still configuration for one agent run, not a general workflow canvas.

### 2. Google Drive is knowledge-only

Drive is intentionally excluded from live chat tool execution.

### 3. Composio session cache is process-local

The current session cache uses in-memory storage in the Next.js process with a 30-minute TTL. This is
fine for MVP latency and repeated-use optimization, but it is not cross-instance state and should be
revisited if multi-instance or high-scale deployment becomes a priority.

### 4. Runtime uses two state models today

Authenticated preview/chat primarily uses the current `agents` record plus current attachment tables.

Live widget chat is different:

- deploy snapshots `published_version_id` into `widget_agents`
- public widget chat resolves the selected agent from that published version snapshot
- widget branding and config still come from current widget rows

So runtime is not one single immutable model yet, but widgets are already more version-bound than authenticated preview chat.

### 5. Approval schema exists but customer-facing approvals are disabled

The database still contains approval-related tables from the phase 3 runtime controls work, but the live customer chat flow does not currently stop on approval.

### 6. No durable async orchestration layer

There is no Trigger.dev worker, queue, or scheduler for conversational or automation actions. Knowledge ingestion is triggered directly. Automation events are processed through Next.js `after()` and should be moved to durable retry/queue infrastructure before high-volume or strict-SLA usage.

## How to Extend the System Safely

### If you add a new live integration

Update these layers together:

1. `src/lib/integrations.ts`
2. `src/lib/composio.ts`
3. connections page + authorize endpoint
4. builder node/picker if it should be agent-attachable
5. preview display
6. `src/lib/tool-actions.ts` action extraction
7. runtime guidance/filter logic
8. automation executor wiring if the tool should be available to automation runs
9. docs in `docs/guides/adding-integrations.md` and `docs/guides/automation-agents.md`

Do not expose an integration directly to runtime without first deciding:

- is it a chat tool or a knowledge import source
- which exact tools are allowed
- whether it should be a singleton tool node or not

### If you add a new knowledge source type

Update these layers together:

1. source creation API
2. storage/import logic
3. processing function
4. supported MIME/type guards
5. knowledge UI

Keep the architectural rule intact:

- retrieval should still happen from Supabase, not directly from the third-party source during chat

### If you change the runtime loop

Be careful with:

- max iteration limits
- persistence of tool messages
- final-answer recovery
- user-visible transcript filtering
- idempotency for action tools

The multi-step loop is the core reliability mechanism for tool-using agents. Avoid reverting to single-step “tool then hope” behavior.

### If you move toward a published-runtime model

Decide explicitly whether runtime should read from:

- current `agents` + current attachments
- or immutable `agent_versions`

Right now the code favors current live state for fast iteration.

## Recommended Maintenance Checklist

When making major changes, verify all of the following:

1. Builder save still writes the expected draft + attachment state
2. Preview still loads the same attached knowledge and tools the builder selected
3. Chat runtime still hides raw tool payloads from the customer transcript
4. Live tools are still limited by the product-owned allowlist
5. Google Drive imports still become normal Supabase knowledge sources
6. Knowledge retrieval stays agent-scoped and workspace-scoped
7. Run and step observability still reflect the actual runtime path
8. RLS policies still match the intended workspace boundaries
9. Hosted and embedded widget bootstrap still respect the intended origin split
10. Public widget chat still enforces one active turn per session with `SESSION_BUSY` on overlap
11. Widget-builder preview chat still consumes workspace credits before model execution even though preview-token traffic skips public rate limits
12. Widget runtime changes still pass the load-test harness before shipping

## Source Files Worth Reading First

For a new engineer joining this codebase, these are the most important files to read first:

1. `src/app/(app)/layout.tsx`
2. `src/lib/app/bootstrap.ts`
3. `src/lib/app/profile-sync.ts`
4. `src/app/api/agents/[id]/chat/route.ts`
5. `src/lib/composio.ts`
6. `src/lib/integrations.ts`
7. `src/lib/knowledge.ts`
8. `supabase/functions/process-knowledge-source/index.ts`
9. `supabase/functions/search-knowledge/index.ts`
10. `src/app/(app)/agents/[id]/builder/page.tsx`
11. `src/app/(app)/agents/[id]/preview/page.tsx`
12. `src/lib/widgets/server.ts`
13. `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
14. `apps/widget-v2/src/Widget.tsx`
15. `scripts/widget-load-test.mjs`
16. `src/lib/dashboard/summary.ts`

## Summary

The current architecture is a focused full-stack agent platform built around one principle:

- configure agents in Next.js
- persist state in Supabase
- retrieve knowledge from Supabase
- use external actions through Composio
- run the agent through a bounded multi-step tool loop
- keep the end-user experience conversational and clean

That gives the project a practical MVP foundation while keeping the core architecture extensible for future integrations and more capable agent behaviors.
