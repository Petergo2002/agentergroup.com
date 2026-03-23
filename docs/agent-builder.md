# Agent Builder

Last updated: 2026-03-20

## Purpose

This document is the implementation-level source of truth for the current agent builder.

It describes:

- what the builder page does today
- which data it loads and saves
- what "save", "publish", and "rollback" actually mean
- how builder choices affect preview chat and deployed widgets
- which files must be updated when the builder changes

This doc should be updated in the same PR whenever builder behavior changes.

## Product Role

The product centers on the `agent`, not the canvas itself.

The builder is the editing surface for configuring an agent's:

- identity and instructions
- model
- starter prompts
- timezone
- end-of-chat policy
- attached knowledge sources
- attached live chat tools
- published version history

The current builder is intentionally narrow. It is not a general workflow engine.

## Route and Main Files

Primary route:

- `src/app/(app)/agents/[id]/builder/page.tsx`

Related files:

- `src/components/modals/CreateAgentModal.tsx`
- `src/components/agents/AgentViewTabs.tsx`
- `src/lib/agents/defaults.ts`
- `src/lib/integrations.ts`
- `src/lib/types.ts`
- `src/app/api/agents/[id]/knowledge/route.ts`
- `src/app/api/agents/[id]/rollback/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/lib/runtime/agent-chat.ts`

## Current Builder Model

### Fixed nodes

These nodes always exist and cannot be removed:

- `trigger`
- `agent`
- `output`

They are created by:

- `createTriggerNode(...)`
- `createAgentCoreNode(...)`
- `createOutputNode(...)`

### Optional nodes

The builder currently supports these optional node kinds:

- `knowledge`
- `gmail`
- `googlecalendar`
- `endchat`

Current limits:

- only one `knowledge` node
- only one `gmail` node
- only one `googlecalendar` node
- only one `endchat` node
- no custom node types
- no arbitrary edge editing

Edges are rebuilt automatically from the node list by `buildEdges(...)`.

The current flow shape is always:

```text
User Message -> Agent -> Assistant Response
                 -> Knowledge (optional)
                 -> Gmail (optional)
                 -> Google Calendar (optional)
Assistant Response -> End Chat (optional)
```

## What the Builder UI Exposes

### Agent inspector

When the `agent` node is selected, the right panel edits:

- `name`
- `description`
- `model`
- `instructions`
- `timezone`
- `starter prompts` (up to 3 visible inputs)

Current model options are hardcoded:

- `openai/gpt-4o-mini`
- `openai/gpt-4.1-mini`
- `anthropic/claude-3.7-sonnet`
- `google/gemini-2.5-flash`

### Knowledge inspector

When the `knowledge` node is selected, the builder shows workspace knowledge sources and allows attachment by checkbox.

Important current behavior:

- only sources in the current workspace can be attached
- sources that are not ready cannot be selected
- the builder stores selected source ids on the node and syncs them to `agent_knowledge_sources`

### Tool inspector

When `gmail` or `googlecalendar` is selected, the builder lets the user choose one connected account for that tool.

Important current behavior:

- only chat-surface integrations are shown in the builder
- the selectable connection is stored on the node as `connectionId`
- the actual durable mapping is synced to `agent_connections`
- Gmail also exposes a per-node recipient policy:
  - `ai_decides`
  - `specific_email`
- when Gmail uses `specific_email`, the node stores the hidden fixed recipient on the draft definition and runtime enforces it server-side
- Google Calendar exposes one selected booking calendar and resolves the booking timezone from that calendar
- the builder loads selectable Google Calendars from the connected Composio account through `/api/connections/googlecalendar/calendars`
- the selected Google Calendar is stored on the node as `calendarId` plus `calendarLabel`
- the Google Calendar node also stores the resolved calendar timezone returned by the selected booking calendar
- the calendar-list route is backed by a manual `GOOGLECALENDAR_LIST_CALENDARS` Composio tool execution, so the app must define Composio toolkit versions centrally for Google Calendar to keep the selector stable

### End Chat inspector

When `endchat` is selected, the builder edits:

- `inactivityTimeoutSeconds`
- `allowAssistantSuggestion`

Important current behavior:

- `endchat` is a control/config node, not a live external integration
- the assistant may only suggest completion
- widget session completion is handled by the backend runtime and public completion endpoints
- preview inactivity timeout behavior is coordinated by the preview UI
- preview and widget runtimes both use this node to expose session-completed behavior, but not through one identical enforcement path

Allowed actions are currently informational and hardcoded:

- Gmail:
  - `Send Email`
- Google Calendar:
  - `Create Event`
  - `Quick Add`
  - `Get Current Date Time`
  - `Find Free Slots`
  - `List Calendars`

### Library and tool picker

The left drawer is a node library.

Current behavior:

- `Agent Core` and `Response` are fixed and non-addable
- `Knowledge` can only be added once
- `End Chat` can only be added once
- `Connected Tools` opens a picker for Gmail and Google Calendar
- a tool can only be added if there is at least one connected account for that tool

## Create, Load, Normalize

### Agent creation

New agents are created from `CreateAgentModal`.

Creation currently does two writes:

1. insert a row into `agents`
2. insert a starter draft into `agent_drafts`

The initial definition comes from `buildInitialDefinition('custom')` in `src/lib/agents/defaults.ts`.

### Builder loading

`loadBuilder()` loads all builder state in parallel:

- `agents`
- `agent_drafts`
- `agent_versions`
- `connections`
- `agent_connections`
- current auth user
- `knowledge_sources`
- attached knowledge sources through `/api/agents/[id]/knowledge`

### Definition normalization

The builder does not trust the stored definition blindly.

`normalizeDefinition(...)` rebuilds the canvas from:

- the stored draft definition
- attached tool connections
- attached knowledge source ids

It also includes backward-compatibility behavior:

- old or malformed nodes are ignored
- duplicate node kinds are collapsed
- a legacy combined tools node is dropped
- tool nodes are rehydrated from the currently attached connections
- `endchat` is preserved only when it matches the supported singleton node shape

This means the builder treats the current supported node set as canonical, not the raw historical JSON.

## Save, Publish, Rollback

### Save Draft

`Save Draft` is manual. There is no autosave today.

Saving does all of the following:

1. updates the `agents` row with:
   - `name`
   - `description`
   - `instructions`
   - `model`
   - `starter_prompts`
   - `timezone`
2. upserts `agent_drafts` with the current `definition`
3. replaces the rows in `agent_connections`
4. replaces the rows in `agent_knowledge_sources` through `/api/agents/[id]/knowledge`

Important implication:

- unsaved UI edits are local browser state only
- preview and downstream systems only reflect the last saved draft, not the current unsaved canvas

### Publish

`Publish` always calls `saveDraft()` first.

After that it:

1. finds the latest version number in `agent_versions`
2. inserts a new immutable version snapshot into `agent_versions`
3. updates the `agents` row with:
   - `status = active`
   - `published_version_id = new version id`
   - current core config fields

Publishing is what creates the version snapshot used for deployments.

### Rollback

Rollback is handled by `POST /api/agents/[id]/rollback`.

Current behavior:

1. load the selected `agent_versions` row
2. update the `agents` row from that version's `definition.config`
3. set `published_version_id` back to that version
4. upsert `agent_drafts` with the rolled-back definition
5. increment the draft version counter

Important limitation:

- rollback restores core config from the selected version
- attached connections and knowledge mappings are not separately reconstructed in the rollback route
- the builder will normalize the next time it loads using current durable attachment tables

## Preview and Runtime Impact

### Preview tab

The builder and preview are the two agent views today:

- `Builder`
- `Preview`

Preview lives at:

- `src/app/(app)/agents/[id]/preview/page.tsx`

Preview chat uses:

- `/api/agents/[id]/chat`
- `runAgentChat(...)` in `src/lib/runtime/agent-chat.ts`

Important implication:

- preview does not auto-save on tab navigation
- preview reflects the last saved draft and current durable attachments
- unsaved builder edits stay local until the user explicitly saves or publishes

### What builder choices affect at runtime

The runtime reads tool and knowledge availability from durable attachment tables:

- tools from `agent_connections`
- knowledge from `agent_knowledge_sources`

The runtime reads core agent settings from the `agents` table:

- model
- instructions
- timezone

The preview chat route also inspects the saved draft definition to extract:

- the Google Calendar node resolved booking timezone
- the Google Calendar selected booking calendar
- the Gmail recipient policy
- the `endchat` policy

### Widgets and published agents

Widgets depend on published agent versions.

Current deployment behavior:

- a widget cannot deploy if any attached agent has no `published_version_id`
- widget deployment snapshots each widget-agent mapping with the agent's published version id
- widget runtime also reads builder-derived policies from the published definition, including:
  - Gmail recipient policy
  - Google Calendar selected booking calendar
  - `endchat` policy

So the builder affects widgets in two stages:

1. `Save Draft` updates the editable current agent state
2. `Publish` creates the version that widgets can deploy against

## Current UX and State Rules

### Supported interactions

- select nodes
- edit the selected node in the inspector
- add knowledge
- add Gmail
- add Google Calendar
- remove optional nodes
- save draft
- publish
- open published version history
- rollback to an older published version
- undo/redo canvas changes in memory

### Current limitations

- no autosave
- no multi-step workflow logic
- no arbitrary branches or custom edges
- no multiple knowledge nodes
- no multiple accounts per node
- no per-tool custom action permissions in the UI
- no node execution testing inside the builder
- no diff view between versions
- undo/redo is in-memory only and resets on reload
- history tracks node and edge state, not every text field edit as a separate durable event

## Durable Data Model

### Tables the builder relies on

- `agents`
- `agent_drafts`
- `agent_versions`
- `connections`
- `agent_connections`
- `knowledge_sources`
- `agent_knowledge_sources`

### Builder definition shape

`BuilderDefinition` currently stores:

- `nodes`
- `edges`
- optional `viewport`
- `config`

`config` currently includes:

- `model`
- `instructions`
- `starterPrompts`
- `timezone`

### Node data types

Current supported node data types in `src/lib/types.ts`:

- `TriggerBuilderNodeData`
- `AgentBuilderNodeData`
- `KnowledgeBuilderNodeData`
- `EndChatBuilderNodeData`
- `GmailBuilderNodeData`
- `GoogleCalendarBuilderNodeData`
- `OutputBuilderNodeData`

Important current tool-node fields:

- `GmailBuilderNodeData`
  - `connectionId`
  - `recipientMode`
  - `recipientEmail`
- `GoogleCalendarBuilderNodeData`
  - `connectionId`
  - `timezone`
  - `calendarId`
  - `calendarLabel`
  - `includePrimaryCalendar`

### Composio toolkit versions

The app uses two different Composio execution models:

- session-backed chat tool execution for runtime chat
- manual `composio.tools.execute(...)` calls for utility workflows such as:
  - listing Google Calendars for the builder
  - Drive file listing and metadata lookup

Important operational detail:

- manual tool execution requires explicit toolkit versions in the current Composio SDK
- the app therefore sets toolkit versions centrally when the Composio client is created in `src/lib/composio.ts`
- current defaults are defined for:
  - Gmail
  - Google Calendar
  - Google Drive
- these can be overridden via environment variables:
  - `COMPOSIO_TOOLKIT_VERSION_GMAIL`
  - `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
  - `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`

This is why Google Calendar's booking-calendar selector and Google Drive import utilities do not pass per-request versions manually.

If a new node type is added, these types must be extended first.

## Source of Truth Rules

When changing the builder, treat these as the source-of-truth layers:

1. `src/lib/types.ts`
   Defines the durable builder schema.
2. `src/app/(app)/agents/[id]/builder/page.tsx`
   Defines the current editor UX and normalization rules.
3. `agents`, `agent_drafts`, `agent_versions`, `agent_connections`, `agent_knowledge_sources`
   Define the durable persisted state.
4. `src/lib/runtime/agent-chat.ts` and related routes
   Define what the saved builder state actually does at runtime.

If these layers disagree, runtime behavior wins over UI assumptions.

## Change Checklist

If you add or change a builder feature, review this list:

- Update `src/lib/types.ts`
- Update `src/app/(app)/agents/[id]/builder/page.tsx`
- Update `src/lib/agents/defaults.ts` if the default canvas or config changed
- Update `src/lib/integrations.ts` if a new live tool was added
- Update `src/app/api/agents/[id]/knowledge/route.ts` if knowledge attachment behavior changed
- Update `src/app/api/agents/[id]/rollback/route.ts` if rollback semantics changed
- Update `src/app/api/agents/[id]/chat/route.ts` and `src/lib/runtime/agent-chat.ts` if runtime behavior changed
- Update widget deployment behavior if publish/version semantics changed
- Update this document in the same PR

## Recommended Next Documentation Rule

For builder-related PRs, require this check:

- if the PR changes builder behavior, node types, persistence, publish semantics, or runtime interpretation, `docs/agent-builder.md` must be updated too

That keeps this file as the living source of truth instead of a one-time writeup.
