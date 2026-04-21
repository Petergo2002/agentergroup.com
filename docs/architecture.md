µ# Agent Platform Architecture

Last updated: 2026-04-19

## Purpose

This document is the implementation-level architecture reference for the current `Agent Platform` codebase. It explains:

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
- workspace-scoped knowledge base with semantic retrieval
- limited live tools for Gmail, Microsoft Outlook, Google Calendar, and Cal.com
- Google Drive only as a knowledge import source
- internal assistant toolkit for Text to PDF generation

This is not currently a workflow automation platform. There is no active Trigger.dev orchestration, no scheduled jobs, and no post-conversation workflow engine.

## High-Level System

```text
Browser (Next.js App Router UI)
  -> Next.js route handlers
    -> Supabase Postgres (app data)
    -> Supabase Storage (raw uploaded knowledge files)
    -> Supabase Edge Functions (knowledge processing + semantic search)
    -> OpenRouter (LLM chat completions)
    -> Composio (tool auth, connected accounts, tool execution)
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

- Next.js `16.1.6`
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

- `docs/agent-builder.md`
- `docs/architecture.md`
- `docs/composio-integrations.md` — **read this before writing any Composio tool integration**

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
- `src/app/(app)/settings/subprocessors/page.tsx`
- `src/app/(app)/settings/data-processing/page.tsx`
- `src/app/privacy-policy/page.tsx`
- `src/app/subprocessors/page.tsx`
- `src/app/data-processing/page.tsx`
- `src/app/login/page.tsx`
- `src/app/login/actions.ts`

### Server APIs

- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/active/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/lookup/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/export/route.ts`
- `src/app/api/workspaces/[id]/privacy/dsar/delete/route.ts`
- `src/app/api/internal/privacy/retention/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/api/agents/[id]/knowledge/route.ts`
- `src/app/api/agents/[id]/archive/route.ts`
- `src/app/api/agents/[id]/rollback/route.ts`
- `src/app/api/agents/[id]/widget/route.ts`
- `src/app/api/assistants/route.ts`
- `src/app/api/assistants/[id]/route.ts`
- `src/app/api/assistants/[id]/threads/route.ts`
- `src/app/api/assistants/[id]/chat/route.ts`
- `src/app/api/connections/toolkits/route.ts`
- `src/app/api/connections/authorize/route.ts`
- `src/app/api/connections/googlecalendar/calendars/route.ts`
- `src/app/api/connections/cal/event-types/route.ts`
- `src/app/api/knowledge/sources/route.ts`
- `src/app/api/knowledge/sources/[id]/route.ts`
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
- `src/app/api/dashboard/analytics/conversations/[widgetSessionId]/route.ts`

### Core libraries

- `src/lib/env.ts`
- `src/lib/app/bootstrap.ts`
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

Authentication is handled by Supabase Auth.

- login and signup actions live in `src/app/login/actions.ts`
- browser/server Supabase clients are created in:
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/server.ts`

### Workspace bootstrap flow

`src/lib/app/bootstrap.ts` guarantees that every authenticated user has:

- a `profiles` row
- at least one workspace
- at least one workspace membership
- one active workspace in app context

Current behavior:

1. Upsert profile from authenticated user data
2. Load all workspace memberships for the user
3. If none exist, create a default owner workspace
4. Resolve the active workspace using:
   - `active_workspace_id` cookie if it still matches a valid membership
   - otherwise the first owner workspace
   - otherwise the first available membership
5. Return:
   - profile
   - active workspace
   - active membership
   - all available workspaces

This logic is important because almost all app data is workspace-scoped.

### Active workspace selection

The active workspace is session-scoped through an HTTP-only cookie:

- `active_workspace_id`

It is written through:

- `POST /api/workspaces`
- `POST /api/workspaces/active`

This keeps workspace switching centralized in bootstrap/context instead of spreading special logic through individual pages.

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
> and `data` fields are sometimes JSON strings. Always read `docs/composio-integrations.md`
> before writing a new tool extractor.

## Database Architecture

The schema is organized into four main domains.

### 1. Identity and workspaces

- `profiles`
- `workspaces`
- `workspace_members`

Purpose:

- represent the authenticated user
- define tenant boundaries
- scope all product data to a workspace
- let one operator manage multiple client workspaces

### 2. Agents and builder state

- `agents`
- `agent_drafts`
- `agent_versions`

Purpose:

- `agents`: current editable/live agent metadata, including the primary `surface` (`assistant` or `widget`)
- `agent_drafts`: builder draft definition and current graph/config
- `agent_versions`: published snapshots for version history and rollback

Important current behavior:

- the builder edits the current agent and current draft directly
- preview and internal assistant runtime both read from the current agent plus the last saved draft state
- publish creates versioned snapshots, but runtime is not exclusively version-bound
- publish is only required for widget agents; internal assistants become usable after the first normal save and move from `draft` to `active`

### 3. Connections and runtime conversations

- `connections`
- `agent_connections`
- `chat_threads`
- `messages`
- `runs`
- `run_steps`
- `run_approvals`
- `audit_logs`

Purpose:

- `connections`: workspace-level external app connections
- `agent_connections`: which connections a specific agent is allowed to use
- `chat_threads`: conversation containers with a `source` of `preview` or `assistant`
- `messages`: user, assistant, and internal tool messages
- `runs`: one top-level execution per user message
- `run_steps`: detailed runtime trace
- `run_approvals`: approval records retained from the phase 3 schema
- `audit_logs`: coarse event logs

Important current behavior:

- the customer-facing chat flow no longer pauses for approvals
- approval schema still exists for future internal/governed flows
- internal assistant threads are shared across the workspace and use per-thread active-turn locks
- preview threads remain creator-scoped and are kept separate from assistant threads through `chat_threads.source`

### 4. Knowledge base

- `knowledge_sources`
- `knowledge_chunks`
- `agent_knowledge_sources`
- RPC: `match_agent_knowledge_chunks`

Purpose:

- `knowledge_sources`: workspace knowledge library
- `knowledge_chunks`: embedded chunk storage
- `agent_knowledge_sources`: which sources are attached to which agent
- `match_agent_knowledge_chunks`: similarity search scoped to one agent and workspace

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
- `googlecalendar`
- `cal`
- `output`

### Builder constraints

Current canvas rules:

- fixed `Trigger`
- fixed core `Agent`
- fixed `Output`
- optional singleton `Knowledge`
- optional singleton `End Chat`
- optional singleton `Gmail`
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

- read-only
- represents the user message entry point

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

Live tool capability is locked to:

- `GMAIL_SEND_EMAIL`

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

For the full response shape and extractor implementation details, see `docs/composio-integrations.md`.

Live tool capability is locked to:

- `CAL_GET_AVAILABLE_SLOTS`
- `CAL_CREATE_BOOKING`

#### Output

- read-only
- represents the final assistant response

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
- the dashboard app sends baseline browser protections through CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`
- widget appearance is configured through theme mode plus primary and secondary accent colors; base surfaces/text are derived in the runtime
- preview mode uses a different signed preview token flow
- the widget runtime shows a lightweight first-message consent gate before the first real chat turn and links it to the public `/privacy-policy` route
- consent is currently remembered client-side per widget public key so returning visitors are not blocked on every new session
- widget session/activity data, widget messages, and widget leads are currently covered by a 180 day retention policy enforced by an internal purge route
- public widget POST endpoints now enforce volumetric rate limiting for hosted and embedded traffic
- preview-token traffic is intentionally excluded from the public widget rate limiter
- the current rollout design and thresholds are documented in `docs/implementation-plans/20260409-widget-rate-limits-plan.md`
- the rate-limit RPC must upsert with `ON CONFLICT ON CONSTRAINT rate_limit_windows_scope_window_constraint`; using a bare column-list conflict target can reintroduce ambiguous `window_started_at` failures in Postgres
- self-service password reset and a backup/restore operator runbook remain follow-up work outside this batch

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

Preview requests can resolve runtime config without deploying the widget publicly.

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
- public widget chat, events, completion, and lead submission routes are also protected by dedicated rate limits with `429` responses and `Retry-After`
- user, assistant, and tool messages are persisted
- lead submissions are stored against the active widget session where possible and the public response is intentionally minimized to `leadId` plus `createdAt`
- session completion can happen through explicit public completion calls, including inactivity-timeout completion
- widget chat streams token deltas over SSE and client-triggered aborts are propagated through the server runtime to the upstream model request
- terminal SSE failures now emit a generic client-safe error payload instead of raw exception text

## Analytics Architecture

Analytics is a workspace-level operations surface focused on widget conversations.

Main surfaces:

- `/analytics`
- `GET /api/dashboard/analytics`
- `GET /api/dashboard/analytics/conversations/[widgetSessionId]`

Current behavior:

- analytics is built from widget session, message, lead, and failure data
- the primary UI is split between a chat/inbox view and a KPI overview view
- analytics excludes preview sessions and focuses on customer-facing widget traffic
- production does not persist raw tool debug payloads into stored assistant/widget traces
- conversation-detail `debugTrace` remains available only to workspace owners and admins

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

## Composio Architecture

Composio integration lives in:

- `src/lib/composio.ts`
- `src/lib/integrations.ts`

### Supported integrations

The product-owned integration catalog currently allows only:

- `gmail`
- `googlecalendar`
- `googledrive`

This is intentionally narrow. Unsupported marketplace-style integrations are not part of the current product surface.

### Current tool policy

#### Chat-capable integrations

- Gmail
  - `GMAIL_SEND_EMAIL`
- Google Calendar
  - `GOOGLECALENDAR_CREATE_EVENT`
  - `GOOGLECALENDAR_QUICK_ADD`
  - `GOOGLECALENDAR_GET_CURRENT_DATE_TIME`
  - `GOOGLECALENDAR_FIND_FREE_SLOTS`
  - `GOOGLECALENDAR_LIST_CALENDARS`

#### Knowledge-only integration

- Google Drive
  - not available as a live customer chat tool
  - used only to import files into the Supabase knowledge base

### Session model

The current implementation creates Composio tool-router sessions per user.

Important operational detail:

- sessions are cached in memory inside the Next.js server process
- TTL is currently 30 minutes
- this improves repeated use during a session
- it is not durable across deploys or cold starts

This is acceptable for the current MVP, but it is an important scaling constraint for future infrastructure work.

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
- `googlecalendar`
- `googledrive`

These defaults can be overridden with environment variables:

- `COMPOSIO_TOOLKIT_VERSION_GMAIL`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`

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
- Google Calendar
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
4. backend creates a Composio managed auth config, links the connected account flow, and upserts a `connections` row as pending
5. user completes external provider auth
6. app later syncs the connected account into `connections`

Important runtime rule:

- connected accounts are keyed to the workspace-scoped Composio identity
- stale legacy rows without the expected scoped identity are treated as disconnected until reconnected
- previously synced Composio rows whose `external_id` no longer exists upstream are downgraded to `disconnected` on the next sync instead of being left as false-positive connected rows

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

### Supported file formats

Current supported knowledge file types:

- `.txt`
- `.md`
- `.pdf`
- website URLs (converted to markdown)

MIME types:

- `text/plain`
- `text/markdown`
- `application/pdf`

Google Docs, Sheets, Slides, images, and general binaries are not part of the current supported import surface.

### Storage architecture

#### Postgres

- `knowledge_sources`
- `knowledge_chunks`
- `agent_knowledge_sources`

#### Storage

- bucket: `knowledge-files`

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
| `POST /api/agents/[id]/archive` | Archive an agent |
| `POST /api/agents/[id]/rollback` | Roll back to a prior version |
| `GET /api/agents/[id]/widget` | Legacy moved response pointing callers to `/widgets?agent=...` |
| `POST /api/agents/[id]/widget` | Legacy moved response pointing callers to `/widgets?agent=...` |

### Connection APIs

| Route | Purpose |
| --- | --- |
| `GET /api/connections/toolkits` | Return supported integrations and merged connection status |
| `POST /api/connections/authorize` | Start Composio authorization for one allowed integration |
| `POST /api/connections/disconnect` | Remove a local connection row and best-effort delete the upstream Composio connected account |
| `GET /api/connections/googlecalendar/calendars` | List selectable calendars for one connected Google Calendar account in the builder |

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
| `POST /api/public/widgets/[widgetPublicKey]/chat` | Process a public widget chat message, reject overlapping same-session turns with `409 SESSION_BUSY`, and rate-limit abusive hosted/embed traffic with `429` |
| `POST /api/public/widgets/[widgetPublicKey]/complete` | Mark a widget session completed, currently for inactivity timeout, refuse completion while a live turn is active, and apply public runtime rate limits backed by the named `rate_limit_windows_scope_window_constraint` upsert path |
| `POST /api/public/widgets/[widgetPublicKey]/events` | Persist widget client events under public runtime rate limits without surfacing SQL ambiguity errors from the rate-limit RPC |
| `POST /api/public/widgets/[widgetPublicKey]/leads` | Persist a lead submission from the widget under public runtime rate limits and return a minimal success payload |

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

### Server-only

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_DATA_COLLECTION`
- `OPENROUTER_REQUIRE_ZDR`
- `COMPOSIO_API_KEY`
- `COMPOSIO_TOOLKIT_VERSION_GMAIL`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
- `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WIDGET_APP_URL`
- `WIDGET_ACCESS_SECRET`
- `WIDGET_PREVIEW_SECRET`
- `GDPR_RETENTION_CRON_SECRET`

### Supabase Edge Functions

Expected inside Supabase function runtime:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Observability and Debugging

### Primary runtime records

- `runs`
- `run_steps`
- `audit_logs`

### What these are for

- `runs`: high-level execution record
- `run_steps`: fine-grained runtime trace
- `audit_logs`: event log useful for operator context

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

## Current Constraints and Intentional Simplifications

These are not bugs. They are current architectural decisions.

### 1. Builder is a configuration editor, not a workflow engine

The graph is intentionally limited. There are no condition nodes, loops, schedules, approvals, or background jobs in the active product flow.

### 2. Google Drive is knowledge-only

Drive is intentionally excluded from live chat tool execution.

### 3. Composio session cache is process-local

The current session cache uses in-memory storage in the Next.js process. This is fine for MVP but should be revisited if multi-instance or high-scale deployment becomes a priority.

### 4. Runtime uses two state models today

Authenticated preview/chat primarily uses the current `agents` record plus current attachment tables.

Live widget chat is different:

- deploy snapshots `published_version_id` into `widget_agents`
- public widget chat resolves the selected agent from that published version snapshot
- widget branding and config still come from current widget rows

So runtime is not one single immutable model yet, but widgets are already more version-bound than authenticated preview chat.

### 5. Approval schema exists but customer-facing approvals are disabled

The database still contains approval-related tables from the phase 3 runtime controls work, but the live customer chat flow does not currently stop on approval.

### 6. No async orchestration layer

There is no queue or scheduler for knowledge processing or conversational actions. Knowledge ingestion is triggered directly.

## How to Extend the System Safely

### If you add a new live integration

Update these layers together:

1. `src/lib/integrations.ts`
2. `src/lib/composio.ts`
3. connections page + authorize endpoint
4. builder node/picker if it should be agent-attachable
5. preview display
6. runtime allowlist logic

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
11. Widget runtime changes still pass the load-test harness before shipping

## Source Files Worth Reading First

For a new engineer joining this codebase, these are the most important files to read first:

1. `src/app/(app)/layout.tsx`
2. `src/lib/app/bootstrap.ts`
3. `src/app/api/agents/[id]/chat/route.ts`
4. `src/lib/composio.ts`
5. `src/lib/integrations.ts`
6. `src/lib/knowledge.ts`
7. `supabase/functions/process-knowledge-source/index.ts`
8. `supabase/functions/search-knowledge/index.ts`
9. `src/app/(app)/agents/[id]/builder/page.tsx`
10. `src/app/(app)/agents/[id]/preview/page.tsx`
11. `src/lib/widgets/server.ts`
12. `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
13. `apps/widget-v2/src/Widget.tsx`
14. `scripts/widget-load-test.mjs`

## Summary

The current architecture is a focused full-stack agent platform built around one principle:

- configure agents in Next.js
- persist state in Supabase
- retrieve knowledge from Supabase
- use external actions through Composio
- run the agent through a bounded multi-step tool loop
- keep the end-user experience conversational and clean

That gives the project a practical MVP foundation while keeping the core architecture extensible for future integrations and more capable agent behaviors.
