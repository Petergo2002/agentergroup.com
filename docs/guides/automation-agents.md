# Automation Agents

Last updated: 2026-06-07

## Purpose

This document is the implementation-level source of truth for Automation agents.

Automation agents are normal agents with `surface = 'automation'`. They start from an external trigger event instead of a live chat message, then run the shared agent runtime with the saved instructions, selected knowledge sources, and selected tool nodes.

Automation v1 uses Composio triggers directly. It does not require Trigger.dev.

## Product Model

The builder model is:

```text
External Trigger -> Agent Core
                   -> Knowledge (optional)
                   -> Connected Tools (optional)
```

Current v1 trigger support:

- Provider: Composio
- Toolkit: Gmail
- Trigger slug: `GMAIL_NEW_GMAIL_MESSAGE`

The UI should keep top-level language generic:

- say `Automation`
- say `External Trigger`
- say `Trigger`
- only say `Gmail` inside the selected trigger option or account selector

This keeps the product ready for future Slack, calendar, CRM, or other external triggers without renaming the whole feature.

## User Flow

### Create

`CreateAgentModal` offers these agent types:

- Website Chat
- Automation
- Internal Assistant when internal assistants are enabled for the workspace

Creating an Automation is allowed without a connected account. It creates a draft automation agent with:

- `External Trigger`
- `Agent Core`
- Gmail new-message selected as the first supported trigger option
- no trigger account selected yet

Account selection is required only before activation.

### Save

Automation agents use `Save`, not website deploy/publish controls.

Saving does all of the normal builder persistence:

- updates `agents`
- upserts `agent_drafts`
- syncs selected tool connections into `agent_connections`
- syncs selected knowledge sources into `agent_knowledge_sources`

When the trigger provider is Composio, saving also upserts `agent_automations` through:

- `PUT /api/agents/[id]/automation`

An Automation can stay saved as a draft without a selected trigger account.

Saving an active automation with an unchanged trigger account/config keeps the provider trigger
active. Changing the trigger account or config pauses the automation, removes the old provider
trigger, and requires explicit reactivation. This prevents autosave from silently desynchronizing
the local and Composio states.

### Activate Trigger

Activation happens only through:

- `POST /api/agents/[id]/automation/status`

with:

```json
{ "action": "activate" }
```

Activation validates:

- the agent exists in the active workspace
- the agent is `surface = 'automation'`
- the user can edit the agent
- the agent is not archived
- the workspace automation feature is enabled by an admin
- `COMPOSIO_API_KEY` exists
- `COMPOSIO_WEBHOOK_SECRET` exists
- an `agent_automations` row exists
- a selected Gmail account exists and is connected

If there is no provider trigger yet, activation creates one through Composio and stores `composio_trigger_id`.

If a provider trigger already exists, activation enables it.

Successful activation sets:

- `agent_automations.status = 'active'`
- `agents.status = 'active'`

### Pause Trigger

Pause happens through the same route:

```json
{ "action": "pause" }
```

Pause disables the Composio trigger when `composio_trigger_id` exists, then sets:

- `agent_automations.status = 'paused'`
- `agents.status = 'paused'`

### Activity

Automation agents use:

- `Builder`
- `Activity`

They do not use chat preview.

`/agents/[id]/preview` redirects automation agents to:

- `/agents/[id]/activity`

Activity reads the automation endpoint and shows:

- automation status
- selected trigger
- selected account
- webhook/provider readiness
- recent `runs`
- recent `automation_events`
- run status
- output summary
- event status
- error messages

## Runtime Flow

The live event flow is:

```text
Composio Gmail trigger
  -> POST /api/composio/webhook
  -> verify webhook signature with COMPOSIO_WEBHOOK_SECRET
  -> find active agent_automations row by composio_trigger_id
  -> insert automation_events row
  -> after(() => processAutomationEvent(eventId))
  -> claim event as processing
  -> create runs row
  -> create run_steps row
  -> runAgentChat({ audience: "automation" })
  -> store assistant output, tool messages, knowledge matches, and connected toolkits
  -> mark automation_events processed or failed
  -> update agent_automations.last_event_at or last_error
```

The webhook route handles Composio connected-account expiry events separately. An event with
`type = 'composio.connected_account.expired'` marks matching local connection rows
`disconnected`, records the upstream status reason, moves active/provisioning automations that
use the connection to `error`, and pauses their agents. These expiry events are not inserted into
`automation_events`.

The route also handles `composio.trigger.disabled` by moving the matching automation to `error`
and pausing its agent. The Composio webhook subscription must opt into that event type.

Automation v1 still uses `after()` processing. Durable retry queues/workers are intentionally deferred.

## Tool Execution

Automation runs now use the same shared runtime as preview/chat agents:

- `src/lib/runtime/agent-chat.ts`
- `src/lib/composio.ts`
- `src/lib/tool-actions.ts`

The executor loads the saved builder definition from `agent_drafts`, then extracts:

- enabled tool actions through `extractEnabledToolsFromDefinition`
- Gmail/Outlook recipient policy through `extractGmailRecipientPolicyFromDefinition`
- Google Calendar calendar/timezone selection through `extractGoogleCalendarSelectionFromDefinition`
- Cal.com event type/timezone selection through `extractCalSelectionFromDefinition`

Only connected and selected tool-node accounts can be used.

Current supported action toolkits:

- Gmail
- Microsoft Outlook
- Slack
- HubSpot
- Shopify
- Google Ads
- Google Calendar
- Cal.com

Google Drive remains knowledge-import only and is not a live automation action node.

### Important Safety Rules

Automation mode receives a dedicated system instruction:

- the trigger payload is not a live chat message
- use configured tools only when instructions and payload clearly require action
- do not guess missing details
- do not claim external actions happened unless a tool call succeeded
- summarize what happened, what was done, and what remains unresolved

Email recipient and calendar/event-type constraints are enforced server-side by the existing Composio completion patchers. The model cannot bypass those policies by choosing different tool arguments.

## Data Model

Automation v1 adds two tables.

### `agent_automations`

One row per automation agent.

Important fields:

- `workspace_id`
- `agent_id`
- `connection_id`
- `provider`
- `toolkit_slug`
- `trigger_slug`
- `trigger_config`
- `composio_trigger_id`
- `status`
- `last_event_at`
- `last_error`

Current constraints:

- `provider = 'composio'`
- `toolkit_slug = 'gmail'`
- `trigger_slug = 'GMAIL_NEW_GMAIL_MESSAGE'`
- `status in ('draft', 'provisioning', 'active', 'paused', 'error')`
- `agent_id` must reference an automation agent in the same workspace
- `connection_id`, when present, must reference a connected Gmail account in the same workspace

### `automation_events`

One row per received provider event.

Important fields:

- `workspace_id`
- `agent_id`
- `automation_id`
- `run_id`
- `external_event_id`
- `trigger_slug`
- `payload`
- `status`

Current statuses:

- `received`
- `processing`
- `processed`
- `ignored`
- `failed`

The uniqueness constraint on `(automation_id, external_event_id)` prevents duplicate processing of the same provider event.

## Lifecycle Cleanup

Automation lifecycle cleanup is intentional because an active Composio trigger can continue sending events even when the local agent changes state.

### Archive

`POST /api/agents/[id]/archive`:

- disables the Composio trigger if one exists
- sets the automation row to `paused`
- sets the agent to `paused` when archiving

Restoring does not automatically reactivate the trigger. The user must activate it again.

### Delete

`DELETE /api/agents/[id]`:

- requires the agent to be archived first
- deletes the Composio trigger if one exists
- deletes the local agent row

Cascade deletes remove automation rows/events.

### Disconnect Account

`POST /api/connections/disconnect`:

- finds active/provisioning automations using that connection
- disables provider triggers when present
- clears `connection_id`
- sets automation status to `error`
- sets the related agents to `paused`

This prevents a disconnected account from leaving a still-active provider trigger behind.

### Composio Expiry Webhook

`POST /api/composio/webhook` also handles the exact
`composio.connected_account.expired` lifecycle event. It updates the matching local
`connections` row and pauses/errors affected automations without waiting for an operator to click
disconnect. Other lifecycle event names are not currently handled by this branch.

## Status Rules

Normal agent status changes do not control Automation activation.

`POST /api/agents/[id]/status` rejects automation agents. Use:

- `POST /api/agents/[id]/automation/status`

This keeps website chat lifecycle separate from trigger lifecycle.

## Environment

Required for live automations:

- `COMPOSIO_API_KEY`
- `COMPOSIO_WEBHOOK_SECRET`

The Composio project must have a V3 webhook subscription pointing to
`https://<production-domain>/api/composio/webhook`. Enable at least
`composio.trigger.message` and `composio.connected_account.expired`; also enable
`composio.trigger.disabled` so provider-side polling failures are reflected in the dashboard.

The builder readiness panel exposes both provider and webhook readiness so activation blockers are visible before the user attempts activation.

## Future Trigger Expansion

Keep UI/types generic when adding new triggers:

- `Automation`
- `External Trigger`
- `Trigger`
- `provider`
- `toolkitSlug`
- `triggerSlug`
- `triggerConfig`

Gmail remains the only supported trigger in v1 because the database constraints intentionally restrict:

- `toolkit_slug = 'gmail'`
- `trigger_slug = 'GMAIL_NEW_GMAIL_MESSAGE'`

Future Slack/calendar triggers should loosen those constraints in a migration and extend:

- `src/lib/agents/defaults.ts`
- `src/lib/types/builder.ts`
- `src/app/(app)/agents/[id]/builder/page.tsx`
- `src/app/api/agents/[id]/automation/route.ts`
- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/composio/webhook/route.ts`
- `docs/guides/automation-agents.md`

## Verification Checklist

Use this checklist when changing automation behavior:

- [ ] Create Website Chat agent: starts with chat trigger and agent core.
- [ ] Create Automation agent: starts with external trigger and agent core.
- [ ] Automation can save without selected account.
- [ ] Activation blocks unless the selected Gmail account exists and is connected.
- [ ] Activation creates or enables the Composio trigger.
- [ ] Pause disables the Composio trigger and updates local status.
- [ ] Real Composio webhook verifies and stores `automation_events`.
- [ ] Executor ignores archived or inactive automation agents.
- [ ] Executor stores run output and tool messages.
- [ ] Activity shows recent runs/events and errors.
- [ ] Archive disables provider trigger.
- [ ] Delete deletes provider trigger.
- [ ] Disconnecting a used Gmail account pauses/errors the automation and disables provider trigger.
- [ ] A Composio connected-account expiry webhook marks the connection disconnected and pauses/errors affected automations.
- [ ] A Composio auto-disabled-trigger webhook pauses/errors the affected automation.
- [ ] Normal `/api/agents/[id]/status` cannot activate an Automation.
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
