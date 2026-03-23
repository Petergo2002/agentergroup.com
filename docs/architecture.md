# Agent Platform Architecture

Last updated: 2026-03-14

## Purpose

This document is the implementation-level architecture reference for the current `Agent Platform` codebase. It explains:

- what the system does today
- which services and APIs it depends on
- how the frontend, backend, database, knowledge base, and integrations fit together
- where the main source-of-truth logic lives
- how to extend the system safely

This document should be treated as the operational source of truth for future maintainers. The phase docs in `docs/` describe roadmap intent; this document describes the current implementation.

## Product Scope

The current product is a conversational AI agent platform with three core capabilities:

1. Build and configure agents in a visual editor
2. Run agents in a live preview chat
3. Let agents use:
   - workspace knowledge stored in Supabase
   - connected external tools through Composio

The current MVP is intentionally narrow:

- chat-first agent runtime
- workspace-scoped knowledge base with semantic retrieval
- limited live tools for Gmail and Google Calendar
- Google Drive only as a knowledge import source

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

### Core app routes

- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/agents/[id]/builder/page.tsx`
- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/knowledge/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/login/page.tsx`
- `src/app/login/actions.ts`

### Server APIs

- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/active/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/api/agents/[id]/knowledge/route.ts`
- `src/app/api/agents/[id]/archive/route.ts`
- `src/app/api/agents/[id]/rollback/route.ts`
- `src/app/api/connections/toolkits/route.ts`
- `src/app/api/connections/authorize/route.ts`
- `src/app/api/knowledge/sources/route.ts`
- `src/app/api/knowledge/sources/[id]/route.ts`
- `src/app/api/knowledge/sources/[id]/process/route.ts`
- `src/app/api/knowledge/drive/files/route.ts`
- `src/app/api/knowledge/drive/import/route.ts`

### Core libraries

- `src/lib/env.ts`
- `src/lib/app/bootstrap.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/openrouter.ts`
- `src/lib/composio.ts`
- `src/lib/integrations.ts`
- `src/lib/knowledge.ts`
- `src/lib/runtime/observability.ts`
- `src/lib/agents/defaults.ts`
- `src/lib/types.ts`

### Supabase

- `supabase/migrations/20260313_phase_2_core_platform.sql`
- `supabase/migrations/20260314_phase_3_runtime_controls.sql`
- `supabase/migrations/20260314_phase_4_knowledge_base.sql`
- `supabase/migrations/20260314_phase_4_storage_and_advisor_cleanup.sql`
- `supabase/functions/process-knowledge-source/index.ts`
- `supabase/functions/search-knowledge/index.ts`
- `supabase/functions/_shared/knowledge.ts`

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

- `agents`: current editable/live agent metadata
- `agent_drafts`: builder draft definition and current graph/config
- `agent_versions`: published snapshots for version history and rollback

Important current behavior:

- the builder edits the current agent and current draft directly
- preview/runtime currently reads from the current `agents` row
- publish creates versioned snapshots, but runtime is not exclusively version-bound

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
- `chat_threads`: conversation containers
- `messages`: user, assistant, and internal tool messages
- `runs`: one top-level execution per user message
- `run_steps`: detailed runtime trace
- `run_approvals`: approval records retained from the phase 3 schema
- `audit_logs`: coarse event logs

Important current behavior:

- the customer-facing chat flow no longer pauses for approvals
- approval schema still exists for future internal/governed flows

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
- `gmail`
- `googlecalendar`
- `output`

### Builder constraints

Current canvas rules:

- fixed `Trigger`
- fixed core `Agent`
- fixed `Output`
- optional singleton `Knowledge`
- optional singleton `Gmail`
- optional singleton `Google Calendar`
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

#### Gmail

Owns one selected Gmail connection.

Live tool capability is locked to:

- `GMAIL_SEND_EMAIL`

#### Google Calendar

Owns one selected Google Calendar connection.

Live tool capability is locked to:

- `GOOGLECALENDAR_CREATE_EVENT`
- `GOOGLECALENDAR_GET_CURRENT_DATE_TIME`
- `GOOGLECALENDAR_FIND_FREE_SLOTS`
- `GOOGLECALENDAR_LIST_CALENDARS`

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

- `Preview` now saves before navigating to preview
- this avoids stale runtime state when a user changes instructions or attached tools and immediately tests the agent

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

This separation is important because the product goal is a frontdesk-style assistant, not a debug console exposed to end users.

## Conversation Runtime Architecture

The main runtime lives in:

- `src/app/api/agents/[id]/chat/route.ts`

This route is the most important backend path in the product.

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

Important note:

- OpenRouter is currently the only LLM transport layer
- the model can be configured per agent, but the transport path is centralized

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

### Connection sync

The app does not treat Composio as the only source of truth for UI state.

Instead it:

1. lists connected accounts from Composio
2. normalizes them
3. syncs them into the `connections` table

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
4. backend upserts a `connections` row as pending
5. user completes external provider auth
6. app later syncs the connected account into `connections`

## Knowledge Base Architecture

The knowledge system is a workspace-level library backed by Supabase Postgres + `pgvector`.

### Source types

Current supported source types:

- pasted text
- uploaded files
- Google Drive imported files

### Supported file formats

Current supported knowledge file types:

- `.txt`
- `.md`
- `.pdf`

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

The runtime does not treat Google Drive as a live retrieval backend.

Instead:

1. Drive file is imported
2. file is stored in Supabase Storage
3. file is processed into chunks and embeddings
4. the agent retrieves from Supabase vector search during chat

This is the right separation because it keeps retrieval:

- fast
- workspace-scoped
- deterministic
- independent from third-party file APIs at answer time

## Knowledge Processing Pipeline

### Main processing function

- `supabase/functions/process-knowledge-source/index.ts`

### Shared helpers

- `supabase/functions/_shared/knowledge.ts`

### Processing sequence

1. Verify caller auth from `Authorization` header
2. Load knowledge source
3. If it is a file source, download the raw file from Supabase Storage
4. Extract text from the file
5. Normalize text
6. Chunk text
7. Generate embeddings with `Supabase.ai.Session("gte-small")`
8. Replace all existing chunks for the source
9. Update source status and chunk count

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
3. User browses Drive-importable files
4. User chooses a supported file
5. Backend downloads the file through Composio
6. Backend creates a `knowledge_sources` row
7. Backend uploads the raw file to Supabase Storage
8. Backend invokes `process-knowledge-source`
9. Source becomes a normal Supabase-backed knowledge source

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

### Connection APIs

| Route | Purpose |
| --- | --- |
| `GET /api/connections/toolkits` | Return supported integrations and merged connection status |
| `POST /api/connections/authorize` | Start Composio authorization for one allowed integration |

### Workspace APIs

| Route | Purpose |
| --- | --- |
| `GET /api/workspaces` | Return the active workspace id and all accessible workspaces |
| `POST /api/workspaces` | Create a new owner workspace and make it active |
| `POST /api/workspaces/active` | Switch the active workspace for the current session |
| `DELETE /api/workspaces/[id]` | Permanently delete an owned workspace, verify the delete actually happened, and move the active cookie to another workspace |

### Knowledge APIs

| Route | Purpose |
| --- | --- |
| `GET /api/knowledge/sources` | List workspace knowledge sources |
| `POST /api/knowledge/sources` | Create a text source or reserve file source upload |
| `DELETE /api/knowledge/sources/[id]` | Delete a source and associated file/chunks |
| `POST /api/knowledge/sources/[id]/process` | Reprocess an existing source |
| `GET /api/knowledge/drive/files` | List importable Google Drive files |
| `POST /api/knowledge/drive/import` | Import a supported Drive file into the knowledge base |

## Environment Variables

The core environment contract is:

### Public/browser-visible

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Server-only

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `COMPOSIO_API_KEY`

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

### 4. Runtime reads current agent state

The runtime primarily uses the current `agents` record plus current attachment tables. Version snapshots exist, but execution is not yet a strict immutable published-runtime model.

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

## Summary

The current architecture is a focused full-stack agent platform built around one principle:

- configure agents in Next.js
- persist state in Supabase
- retrieve knowledge from Supabase
- use external actions through Composio
- run the agent through a bounded multi-step tool loop
- keep the end-user experience conversational and clean

That gives the project a practical MVP foundation while keeping the core architecture extensible for future integrations and more capable agent behaviors.
