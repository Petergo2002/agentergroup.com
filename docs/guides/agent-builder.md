# Agent Builder

Last updated: 2026-06-24

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
- attached knowledge sources and folders
- attached live action tools
- external automation trigger setup
- published version history

The current builder is intentionally narrow. It is not a general workflow engine.
It is also not a reporting surface:

- Builder configures the agent and its trigger/tools.
- Activity shows per-agent automation run history and troubleshooting.
- Analytics shows workspace-level performance, trends, and reporting.

## Route and Main Files

Primary route:

- `src/app/(app)/agents/[id]/builder/page.tsx`

Related files:

- `src/components/modals/CreateAgentModal.tsx`
- `src/components/agents/AgentViewTabs.tsx`
- `src/lib/agents/defaults.ts`
- `src/lib/automation/executor.ts`
- `src/lib/integrations.ts`
- `src/lib/types.ts`
- `src/app/api/agents/[id]/automation/route.ts`
- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/composio/webhook/route.ts`
- `src/app/api/agents/[id]/knowledge/route.ts`
- `src/app/api/agents/[id]/rollback/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/app/(app)/agents/[id]/activity/page.tsx`
- `src/lib/runtime/agent-chat.ts`
- `src/lib/builder-connection-resolver.ts`

## Current Builder Model

### Fixed nodes

These nodes always exist and cannot be removed:

- `trigger`
- `agent`

They are created by:

- `createTriggerNode(...)`
- `createAgentCoreNode(...)`

### Optional nodes

The builder currently supports these optional node kinds:

- `knowledge`
- `gmail`
- `outlook`
- `slack`
- `hubspot`
- `shopify`
- `googleads`
- `googlecalendar`
- `cal`
- `endchat`
- `annotation`

Current limits:

- only one `knowledge` node
- only one `gmail` node
- only one `outlook` node
- only one `slack` node
- only one `hubspot` node
- only one `shopify` node
- only one `googleads` node
- only one `googlecalendar` node
- only one `cal` node
- only one `endchat` node
- text annotation nodes are repeatable canvas notes
- no custom node types
- no arbitrary edge editing

Edges are rebuilt automatically from the node list by `buildEdges(...)`.
Text annotation nodes are deliberately unconnected and do not affect edge rebuilding or runtime behavior.

The website chat flow shape is:

```text
Chat Message Trigger -> Agent Core
                         -> Knowledge (optional)
                         -> Gmail (optional)
                         -> Outlook (optional)
                         -> Slack (optional)
                         -> HubSpot (optional)
                         -> Shopify (optional)
                         -> Google Ads (optional)
                         -> Google Calendar (optional)
                         -> Cal.com (optional)
                         -> End Chat (optional)
```

Text annotations can be placed anywhere on the canvas as documentation notes. They are not part of the chat or automation execution path.

The automation flow shape is:

```text
External Trigger -> Agent Core
                    -> Knowledge (optional)
                    -> Gmail (optional)
                    -> Outlook (optional)
                    -> Slack (optional)
                    -> HubSpot (optional)
                    -> Shopify (optional)
                    -> Google Ads (optional)
                    -> Google Calendar (optional)
                    -> Cal.com (optional)
```

## What the Builder UI Exposes

### Agent inspector

When the `agent` node is selected, the right panel edits:

- `name`
- `description`
- `model`
- `instructions` (includes an **Expanded Editor** modal and an AI-powered **Magic Wand** optimizer)
- `timezone`
- `starter prompts` (up to 3 visible inputs)

**New AI Features:**
- **Expanded Editor:** A large-scale modal for deep prompt engineering, accessible via the "Expand" button.
- **Magic Wand Optimizer:** An OpenRouter-powered feature that rewrites raw instructions into structured, industry-standard system prompts (using the `/api/agents/[id]/optimize-prompt` endpoint). Optimizer calls consume the workspace message quota before the model request.

**Agent Metrics:**
- **Setup Readiness Score:** Replaces the static "Confidence" bar. This is a dynamic score (0-100%) calculated in the UI based on:
  - Custom name (+20%)
  - Description presence (+10%)
  - Robust instructions > 50 chars (+40%)
  - Starter prompts presence (+10%)
  - Attached tools or knowledge (+20%)

Current model options load from `/api/openrouter/models` and fall back to the curated local OpenRouter list when the live catalog is unavailable. If a saved agent uses a model outside the current featured sections, the builder shows it in a separate current-model section instead of silently replacing it.

### Knowledge inspector

When the `knowledge` node is selected, the builder shows workspace knowledge folders and individual sources and allows attachment by checkbox.

Important current behavior:

- only sources in the current workspace can be attached
- only folders in the current workspace can be attached
- sources that are not ready cannot be selected
- folder selections are live: adding a ready source to an attached folder makes it available to the agent without re-saving the agent
- the builder stores selected source ids as `sourceIds` and selected folder ids as `folderIds` on the node
- `POST /api/agents/[id]/knowledge` syncs direct sources to `agent_knowledge_sources` and folders to `agent_knowledge_folders`

### Tool inspector

When `gmail`, `outlook`, `slack`, `hubspot`, `shopify`, `googleads`, `googlecalendar`, or `cal` is selected, the builder shows the selected account for that tool.

Important current behavior:

- only chat-surface integrations are shown in the builder
- the selected connection is stored on the node as `connectionId`
- the actual durable mapping is synced to `agent_connections`
- missing, disconnected, or wrong-toolkit selected accounts are rebound to the newest connected account for the same toolkit when possible
- if a Google Calendar or Cal.com account is rebound, account-specific calendar/event-type fields are cleared so stale selections are not reused
- if no connected account exists for the toolkit, the node remains in a setup/error state and is not persisted as an active runtime attachment
- the tool picker starts provider authorization when no connected account exists; after authorization completes, the tool node can be added
- Gmail and Outlook both expose a per-node recipient policy:
  - `ai_decides`
  - `specific_email`
- when Gmail or Outlook uses `specific_email`, the node stores the hidden fixed recipient on the draft definition and runtime enforces it server-side
- Gmail fixed-recipient mode removes reply-to-thread execution because a hidden fixed recipient cannot safely be combined with an external source thread
- Slack, HubSpot, Shopify, and Google Ads expose the shared connected-account display and action editor; they do not add per-node settings yet
- Google Calendar exposes one selected booking calendar and resolves the booking timezone from that calendar
- Cal.com exposes a scheduling mode: `ai_decides` or `specific_event_type`
- the builder loads selectable Google Calendars or Cal.com event types from the connected Composio account
- if the connection no longer exists in Composio, the app marks the row disconnected and asks the operator to reconnect

### Trigger inspector

When the `trigger` node is selected, the builder lets the user choose what starts the agent.

Current trigger sources:

- `user_message`: internal chat trigger used by Website Chat agents
- `gmail_new_message`: external Composio trigger used by Automation agents. This option is only shown when automations/external triggers are enabled for the current workspace.

Important current behavior:

- choosing the external trigger changes the agent surface to `automation`
- choosing the chat trigger changes a non-assistant agent surface back to `widget`
- the trigger config is stored in `definition.config.trigger`
- Automation v1 stores `provider = 'composio'`, `toolkitSlug = 'gmail'`, and `triggerSlug = 'GMAIL_NEW_GMAIL_MESSAGE'`
- the trigger account is selected on the trigger node as `connectionId`
- the automation can be saved without a selected account
- activation is blocked until the selected Gmail account exists and is connected

The inspector also shows automation readiness:

- saved automation status
- selected trigger
- selected account
- Composio provider env status
- webhook secret status
- provider trigger id when provisioned
- last event
- last error

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

### Text annotation inspector

When `annotation` is selected, the builder edits only the note text.

Important current behavior:

- annotation nodes are canvas-only documentation
- they do not create runtime tools, prompts, knowledge, triggers, or edges
- they are preserved in the draft definition as `TextAnnotationBuilderNodeData`
- they can be removed from the inspector

Tool nodes expose an action editor. Recommended actions are enabled by default, and additional actions can be enabled from the toolkit action list loaded through `/api/connections/toolkits/[toolkitSlug]/tools`.

Google Calendar and Cal.com perform read-only provider calls while loading their calendar/event-type selectors. Those routes sync account state first and mark stale provider accounts disconnected when the provider reports that the stored account no longer exists. Other tool nodes currently validate stored connection state without executing a provider probe.

Default recommended actions:

- Gmail:
  - `Send Email`
  - `Reply To Thread`
- Microsoft Outlook:
  - `Send Email`
- Slack:
  - `Send Message`
  - `Search Messages`
  - `Fetch Conversation History`
  - `Find Channels`
  - `Find Users`
- HubSpot:
  - `Search Contacts By Criteria`
  - `List Contacts`
  - `Create Contact`
  - `Update Contact`
  - `Search Companies`
  - `Create Company`
  - `Update Company`
  - `Search Deals`
  - `Create Deal`
  - `Update Deal`
  - `Create Ticket`
  - `Create Note`
  - `Create Task`
- Shopify:
  - `Get Shop Details`
  - `Get Products Paginated`
  - `Count Products`
  - `List Customers`
  - `Create Customer`
  - `Update Customer`
  - `List Orders`
  - `List Draft Orders`
  - `Create Draft Order`
  - `Update Draft Order`
  - `List Inventory Levels`
  - `Creates A New Product`
  - `Updates A Product`
- Google Ads:
  - `List Accessible Customers`
  - `Get Campaign By Id`
  - `Get Campaign By Name`
  - `Get Customer Lists`
  - `Search Stream GAQL`
- Google Calendar:
  - `Create Event`
  - `Quick Add`
  - `Get Current Date Time`
  - `Find Free Slots`
  - `List Calendars`
- Cal.com:
  - `Get Available Slots`
  - `Create Booking`

### Library and tool picker

The left drawer is a node library.

Current behavior:

- `Trigger` is fixed and non-addable
- `Agent Core` is fixed and non-addable
- `Knowledge` can only be added once
- `End Chat` can only be added once
- `Connected Tools` opens a picker for Gmail, Microsoft Outlook, Slack, HubSpot, Shopify, Google Ads, Google Calendar, and Cal.com
- selecting an unconnected tool starts its provider authorization flow; the node is added after a connected account is available
- `Text annotation` adds a repeatable note node
- the drawer opens on hover and can also be pinned open by click/tap

## Create, Load, Normalize

### Agent creation

New agents are created from `CreateAgentModal`.

Creation currently does two writes:

1. insert a row into `agents`
2. insert a starter draft into `agent_drafts`

The initial definition comes from `buildInitialDefinition('custom', surface)` in `src/lib/agents/defaults.ts`.

Initial node defaults:

- Website Chat: `Chat Message Trigger + Agent Core`
- Automation: `External Trigger + Agent Core`
- Internal Assistant: chat-style trigger and agent core, with assistant surface behavior

Automation creation does not require a connected Gmail account. The account is selected later in the trigger inspector before activation.

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
- automation state through `/api/agents/[id]/automation` when the loaded agent is an automation or the saved trigger is external

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
- `annotation` nodes are preserved as repeatable canvas notes

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
5. upserts `agent_automations` through `/api/agents/[id]/automation` when the trigger provider is Composio

Important implication:

- unsaved UI edits are local browser state only
- preview and downstream systems only reflect the last saved draft, not the current unsaved canvas
- automation activation uses the last saved draft and trigger binding

### Automation Activation and Pause

Automation agents do not use Publish/Deploy.

The builder header shows:

- `Save`
- `Activate Trigger`
- `Pause Trigger`

Activation and pause call:

- `POST /api/agents/[id]/automation/status`

with `action = 'activate'` or `action = 'pause'`.

Important current behavior:

- activation calls `saveDraft()` first
- activation requires `COMPOSIO_API_KEY`
- activation requires `COMPOSIO_WEBHOOK_SECRET`
- activation requires the selected Gmail account to exist and be connected
- activation creates or enables the upstream Composio trigger
- pause disables the upstream Composio trigger
- normal `/api/agents/[id]/status` rejects automation agents
- archive/delete/disconnect lifecycle paths disable or delete provider triggers when needed

### Publish

`Publish Version` always calls `saveDraft()` first and only applies to website chat agents.

After that it:

1. finds the latest version number in `agent_versions`
2. inserts a new immutable version snapshot into `agent_versions`
3. updates the `agents` row with:
   - `status = active`
   - `published_version_id = new version id`
   - current core config fields

Publishing a version is what creates the version snapshot used for deployments.

Automation agents are not version-published for trigger activation in v1. Their active runtime reads the current saved draft plus durable connection and knowledge attachments.

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

### Agent tabs

Website chat and internal assistant agents use:

- `Builder`
- `Preview`

Automation agents use:

- `Builder`
- `Activity`

Preview lives at:

- `src/app/(app)/agents/[id]/preview/page.tsx`

Activity lives at:

- `src/app/(app)/agents/[id]/activity/page.tsx`

Preview chat uses:

- `/api/agents/[id]/chat`
- `runAgentChat(...)` in `src/lib/runtime/agent-chat.ts`

Preview chat is billable. The route calls `consumeWorkspaceMessageUsage()` before the shared OpenRouter runtime runs, and exhausted workspaces receive `MESSAGE_LIMIT_REACHED` over the chat stream.

Important implication:

- preview does not auto-save on tab navigation
- preview reflects the last saved draft and current durable attachments
- unsaved builder edits stay local until the user explicitly saves or publishes
- automation preview redirects to Activity
- Activity shows recent `runs`, `automation_events`, statuses, output summaries, event times, and errors

### What builder choices affect at runtime

The shared runtime reads tool and knowledge availability from durable attachment tables:

- tools from `agent_connections`
- knowledge from `agent_knowledge_sources` and live folder attachments in `agent_knowledge_folders`

The runtime reads core agent settings from the `agents` table:

- model
- instructions
- timezone

The preview chat route and automation executor also inspect the saved draft definition to extract:

- the Google Calendar node resolved booking timezone
- the Google Calendar selected booking calendar
- the Gmail recipient policy
- the `endchat` policy
- selected enabled actions from tool nodes

Automation does not use `endchat`, but it does use selected tool actions, selected knowledge sources, email recipient policy, Google Calendar selection, and Cal.com selection.

### Widgets and published agents

The widget builder has a separate live preview path from the agent preview tab:

- `/api/widgets/[id]/preview` creates or updates a `widget_preview_drafts` row and returns a signed preview token
- the widget runtime then sends preview chat turns to `/api/public/widgets/[widgetPublicKey]/chat`
- preview-token widget chat skips anonymous public rate limiting, but it still consumes workspace message credits before `runAgentChat(...)`
- this means testing a widget agent in the builder spends the same monthly message allowance as deployed widget chat

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
2. `Publish Version` creates the version that widgets can deploy against

## Current UX and State Rules

### Supported interactions

- select nodes
- edit the selected node in the inspector, including Trigger setup for chat versus external automation triggers
- move nodes on the canvas
- add knowledge
- add Gmail
- add Outlook
- add Slack
- add HubSpot
- add Shopify
- add Google Ads
- add Google Calendar
- add Cal.com
- add End Chat
- add text annotations
- remove optional nodes
- save draft
- publish a version
- open published version history
- rollback to an older published version
- undo/redo canvas changes in memory

### Current limitations

- no autosave
- no multi-step workflow logic
- no custom node types
- no multiple knowledge nodes
- no multiple accounts per node
- no arbitrary node execution testing inside the builder
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
- `knowledge_folders`
- `knowledge_folder_sources`
- `agent_knowledge_sources`
- `agent_knowledge_folders`

### Agent Library

The Agent Library lets users submit saved agents as reusable templates, then import approved templates into another workspace.

Main files:

- `src/components/agents/AgentLibraryDialog.tsx`
- `src/components/agents/TemplateVariableSetup.tsx`
- `src/lib/agent-library.ts`
- `src/lib/template-variables.ts`
- `src/app/api/agent-library/route.ts`
- `src/app/api/agent-library/submissions/route.ts`
- `src/app/api/agent-library/submit/route.ts`
- `src/app/api/agent-library/[id]/import/route.ts`
- `src/app/api/admin/agent-library/route.ts`
- `src/app/api/admin/agent-library/[id]/route.ts`
- `src/app/api/admin/agent-library/[id]/review/route.ts`
- `src/app/(admin)/admin/verification/page.tsx`

Database tables:

- `agent_library_templates`
- `agent_library_template_sources`

Current behavior:

- publishing to the library creates a `pending` template from the saved draft definition
- template definitions are sanitized before storage:
  - tool and trigger `connectionId` values are cleared
  - knowledge node `sourceIds` and `folderIds` are cleared
  - Google Calendar calendar/timezone selection is cleared
  - Cal.com event-type/timezone selection is cleared
  - Composio trigger config is cleared
- attached direct knowledge sources and sources reachable through selected folders are snapshotted into `agent_library_template_sources`; file sources are rebuilt from `knowledge_chunks` in chunk order
- required integrations are derived from tool nodes and Composio trigger config
- admins approve, reject, or permanently remove templates from `/admin/verification`
- removing a template also removes its bundled knowledge snapshots through the database cascade
- only approved templates appear in the public library tab
- workspace submissions appear in the user's submissions tab with their review status
- the library grid opens a detail view before import, showing description, bundled knowledge, required integrations, review state, and rejection feedback when present
- importing an approved template creates a draft agent, clones template knowledge as text knowledge sources, links those sources to the agent, and writes a starter `agent_drafts` row
- import enforces workspace feature gates for `assistant` and `automation` surfaces, active agent limits, and knowledge storage limits

Prompt templates may contain `{{variable_name}}` tokens. The library dialog detects those tokens from template instructions, asks the importing user for values, and the import route resolves them before saving the new agent instructions. Supported variable keys are letters, digits, and underscores, starting with a letter.

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
- `trigger`

`config.trigger` stores:

- `source`
- `provider`
- `toolkitSlug`
- `triggerSlug`
- `triggerConfig`
- `connectionId`

### Node data types

Current supported node data types in `src/lib/types.ts`:

- `TriggerBuilderNodeData`
- `AgentBuilderNodeData`
- `KnowledgeBuilderNodeData`
- `EndChatBuilderNodeData`
- `GmailBuilderNodeData`
- `OutlookBuilderNodeData`
- `SlackBuilderNodeData`
- `HubSpotBuilderNodeData`
- `ShopifyBuilderNodeData`
- `GoogleAdsBuilderNodeData`
- `GoogleCalendarBuilderNodeData`
- `CalBuilderNodeData`
- `TextAnnotationBuilderNodeData`

Important current tool-node fields:

- `GmailBuilderNodeData` / `OutlookBuilderNodeData`
  - `connectionId`
  - `recipientMode`
  - `recipientEmail`
- `GoogleCalendarBuilderNodeData`
  - `connectionId`
  - `timezone`
  - `calendarId`
  - `calendarLabel`
  - `includePrimaryCalendar`
- `SlackBuilderNodeData` / `HubSpotBuilderNodeData` / `ShopifyBuilderNodeData` / `GoogleAdsBuilderNodeData`
  - `connectionId`
  - `enabledTools`
- `CalBuilderNodeData`
  - `connectionId`
  - `timezone`
  - `eventTypeMode`
  - `eventTypeId`
  - `eventTypeLabel`
  - `enabledTools`

Important current trigger-node fields:

- `TriggerBuilderNodeData`
  - `triggerSource`
  - `provider`
  - `toolkitSlug`
  - `triggerSlug`
  - `connectionId`
  - `triggerConfig`

Important current annotation-node fields:

- `TextAnnotationBuilderNodeData`
  - `text`

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
  - Cal.com
  - Google Drive
  - Microsoft Outlook
  - Slack
  - HubSpot
  - Shopify
  - Google Ads
- these can be overridden via environment variables:
  - `COMPOSIO_TOOLKIT_VERSION_GMAIL`
  - `COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR`
  - `COMPOSIO_TOOLKIT_VERSION_CAL`
  - `COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE`
  - `COMPOSIO_TOOLKIT_VERSION_OUTLOOK`
  - `COMPOSIO_TOOLKIT_VERSION_SLACK`
  - `COMPOSIO_TOOLKIT_VERSION_HUBSPOT`
  - `COMPOSIO_TOOLKIT_VERSION_SHOPIFY`
  - `COMPOSIO_TOOLKIT_VERSION_GOOGLEADS`

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
5. `src/lib/agent-library.ts` and `src/lib/template-variables.ts`
   Define how reusable templates are sanitized, imported, and personalized.

If these layers disagree, runtime behavior wins over UI assumptions.

## Change Checklist

If you add or change a builder feature, review this list:

- Update `src/lib/types.ts`
- Update `src/app/(app)/agents/[id]/builder/page.tsx`
- Update `src/lib/builder-connection-resolver.ts` if connection selection or stale-account fallback changed
- Update `src/lib/agents/defaults.ts` if the default canvas or config changed
- Update `src/lib/integrations.ts` if a new live tool was added
- Update `src/app/api/agents/[id]/automation/route.ts` and `src/app/api/agents/[id]/automation/status/route.ts` if automation trigger persistence or lifecycle changed
- Update the Agent Library API/routes and `src/lib/agent-library.ts` if template submission/import behavior changed
- Update `src/app/api/composio/webhook/route.ts` and `src/lib/automation/executor.ts` if automation event processing changed
- Update `src/app/api/agents/[id]/knowledge/route.ts` if knowledge attachment behavior changed
- Update `src/app/api/agents/[id]/rollback/route.ts` if rollback semantics changed
- Update `src/app/api/agents/[id]/chat/route.ts` and `src/lib/runtime/agent-chat.ts` if runtime behavior changed
- Update widget deployment behavior if publish/version semantics changed
- Update `docs/guides/automation-agents.md` if the automation trigger flow, lifecycle, data model, or execution behavior changed
- Update this document in the same PR

## Recommended Next Documentation Rule

For builder-related PRs, require this check:

- if the PR changes builder behavior, node types, persistence, publish semantics, or runtime interpretation, `docs/guides/agent-builder.md` must be updated too

That keeps this file as the living source of truth instead of a one-time writeup.
