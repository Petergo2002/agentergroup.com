# Composio Integrations — Implementation Guide

Last updated: 2026-06-24

This document is the mandatory reference for building and debugging Composio tool integrations
in this codebase. Read this before writing any new integration. All lessons here were earned
through production debugging.

---

## Architecture Overview

Composio is used in two product paths:

1. connected action tools used by chat and automation runtimes
2. external trigger webhooks used by Automation agents
3. external no-login auth links used to let another person authorize a provider account into a workspace

### Action tool execution

Most manual Composio utility calls go through:

```
API Route (Next.js)
  → listXxx() in src/lib/composio.ts
    → executeToolCall(userId, "TOOL_SLUG", args, { connectedAccountId })
      → composio.tools.execute(...)
        → result.data  ← THIS is what you extract from
```

`executeToolCall` in `src/lib/composio.ts`:
- Throws if `result.successful === false`
- Returns `result.data` — **not** `result` itself
- So every extractor receives `result.data`, not the full Composio result envelope

Runtime tool calls use Composio tool-router sessions:

```text
runAgentChat(...)
  -> getWrappedTools(userId, enabledToolkits, enabledToolsByToolkit)
  -> OpenRouter model proposes tool calls
  -> handleChatToolCalls(userId, completion, policies)
  -> Composio provider executes the selected tool calls
  -> tool messages are fed back into the bounded model loop
```

This path is shared by:

- preview chat
- internal assistants
- public widget runtime
- automation runs

Automation runs are still limited by the selected builder tool nodes. They do not get every Composio action by default.

Runtime sessions are cached only as process-local best-effort state in `src/lib/composio.ts`.
Tool-router sessions, Composio SDK sessions, and MCP session refs all carry a timestamp and use a
30-minute TTL. Do not rely on these maps as durable or cross-instance state; serverless cold starts
and scale-out can recreate sessions at any time.

### Auth config strategy

Connection starts are owned by `createConnectionRequest()` in `src/lib/composio.ts`.

Default behavior:

- most supported toolkits create a `use_composio_managed_auth` auth config on demand
- Gmail defaults to toolkit version `20260323_00`; override it with `COMPOSIO_TOOLKIT_VERSION_GMAIL` only after validating tool and trigger compatibility
- a real configured auth config id can be supplied through `COMPOSIO_AUTH_CONFIG_<TOOLKIT>` or `COMPOSIO_<TOOLKIT>_AUTH_CONFIG_ID`
- auth config ids are injected into a Composio tool-router session only for the explicit connection-start request, not for every `/connections` page load
- placeholder values such as `*_replace_me` and `ac_...` are ignored

Shopify is the current exception: Composio Managed App is not available for Shopify, so the app either uses a real pre-created Shopify auth config id or creates a `use_custom_auth` OAuth2 config from Shopify app credentials.

### External trigger webhooks

Automation triggers use a different path:

```text
Composio trigger
  -> POST https://dashboard.agentergroup.com/api/composio/webhook
  -> verifyWebhook(...) with COMPOSIO_WEBHOOK_SECRET
  -> lookup agent_automations by composio_trigger_id
  -> insert automation_events
  -> processAutomationEvent(...)
```

Current v1 trigger support:

- `GMAIL_NEW_GMAIL_MESSAGE`

Gmail managed-auth triggers poll rather than receive push notifications. Request a 15-minute
interval; values below that are unsupported for managed auth and are clamped by
`createComposioTrigger()`. The local binding endpoint also returns live provider health so the UI
can distinguish "webhook configured" from "provider trigger active and polling".

The webhook subscription must target the dashboard deployment directly. The apex/marketing domain
does not host Next.js application API routes and must not be used for webhook delivery.
The production dashboard deployment must also set
`NEXT_PUBLIC_APP_URL=https://dashboard.agentergroup.com`.

Gmail action nodes support both new sends (`GMAIL_SEND_EMAIL`) and true thread replies
(`GMAIL_REPLY_TO_THREAD`). Existing nodes preserve their saved action allow-list, so the reply tool
must be enabled explicitly on older automations.

The same webhook route separately handles
`composio.connected_account.expired`. Expiry events update matching local connection state and
pause/error active or provisioning automations; they are not inserted into `automation_events`.
It also handles the opt-in `composio.trigger.disabled` event and pauses/errors the matching
automation when Composio disables an unhealthy trigger.

Trigger creation/enabling/disabling/deletion is owned by:

- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/agents/[id]/automation/route.ts`
- `src/lib/composio.ts`

### Trigger diagnostics

Trace failures in this order; each boundary has different evidence:

1. **Provider trigger:** confirm the stored `composio_trigger_id` exists, is active, has a current
   `last_synced_at`, and references the expected connected account.
2. **Webhook subscription:** confirm the active V3 subscription targets the dashboard API route and
   includes `composio.trigger.message`, `composio.trigger.disabled`, and account-expiry events.
3. **Delivery log:** inspect the HTTP status for the exact trigger event. A provider event with a
   non-2xx delivery never reached application ingestion.
4. **Ingestion:** find the external event ID in `automation_events`. Absence after a successful 2xx
   delivery indicates signature, event-shape, or local-binding lookup failure.
5. **Execution:** inspect the event status, linked `runs` row, and ordered `run_steps`. Context,
   runtime, decision, and action steps identify whether failure happened before model execution or
   during a specific tool call.

Do not store or send the full Gmail MIME payload to the model. The webhook adapter reduces it to
bounded message/thread IDs, sender/recipient fields, subject, readable body, labels, timestamp, and
attachment metadata.

Composio should remain the provider integration layer, not the durable workflow engine. The app
owns event idempotency and audit state. Add a database-backed worker over `automation_events` when
durable retries are required; introduce Trigger.dev only if long-running workflows, scheduled
waits, or richer orchestration justify the additional vendor and duplicated run state.

### External connection auth links

Workspace owners/admins can create a one-integration link from `/connections`.
The public recipient does not need an Agentergroup login. The flow still uses the same
workspace-scoped Composio identity, so the account is connected to `workspace:<workspaceId>`.

Key files:

- `src/app/api/connections/auth-links/route.ts`
- `src/app/api/connections/auth-links/[id]/revoke/route.ts`
- `src/app/api/public/connection-auth-links/[token]/start/route.ts`
- `src/app/connect/[token]/page.tsx`
- `src/app/connect/callback/page.tsx`
- `supabase/migrations/20260512105825_connection_auth_links.sql`

Rules:

- store only the SHA-256 token hash in `connection_auth_links`
- links are bearer secrets and must be treated like passwords
- links are scoped to one supported toolkit
- default expiry is 7 days
- expired, revoked, and completed links cannot start a new Composio auth request
- public routes use the service role because the recipient is intentionally unauthenticated
- callback syncs Composio accounts and marks the link completed only after a connected row exists

---

## Critical Pitfalls (Learn These Before Writing Any Integration)

### ⚠️ Pitfall 1: IDs Are Not Always Strings

**Every `pickString()` call on an ID field is a potential silent data loss.**

Many Composio/third-party APIs return IDs as **integers**, not strings.
The shared `pickString()` helper only accepts `typeof value === "string"` — so
a numeric ID like `42` silently returns `null`, and the item is dropped.

**Rule: Always coerce IDs explicitly:**

```ts
const rawId = record.id ?? record.eventTypeId ?? record.someOtherId;
const id =
  typeof rawId === "number" && rawId > 0
    ? String(rawId)
    : pickString(rawId);
```

Never do this directly for IDs:
```ts
// ❌ WRONG — drops numeric IDs silently
const id = pickString(record.id);
```

Known APIs that return integer IDs:
- **Cal.com** — `id` field on event types (confirmed)
- When in doubt, assume integer and coerce

---

### ⚠️ Pitfall 2: Response Envelopes Vary Wildly Between Tools

**Never assume the array you want is at the top level of `result.data`.**

Each tool has its own response shape. You must map the actual API shape, not guess.

Use the shared extractor pattern with a prioritized bucket list to be resilient:

```ts
function extractXxx(payload: unknown): XxxItem[] {
  // 1. Parse stringified JSON (Composio sometimes wraps data as a JSON string)
  let root = payload;
  if (typeof root === "string") {
    try { root = JSON.parse(root); } catch { return []; }
  }

  const candidate = typeof root === "object" && root !== null
    ? (root as Record<string, unknown>) : null;

  // 2. Parse candidate.data if it is also a JSON string
  let parsedData: Record<string, unknown> | null = null;
  if (candidate?.data && typeof candidate.data === "string") {
    try {
      const d = JSON.parse(candidate.data as string);
      parsedData = typeof d === "object" && d !== null ? d as Record<string, unknown> : null;
    } catch { /* ignored */ }
  } else if (candidate?.data && typeof candidate.data === "object") {
    parsedData = candidate.data as Record<string, unknown>;
  }

  // 3. Try known paths for this specific API, then generic fallbacks
  const buckets = [
    /* put the REAL path for this API first */
    parsedData?.items,          // example for Google Calendar
    candidate?.items,
    candidate?.data,
    Array.isArray(root) ? root : null,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    const items = mapItems(bucket);
    if (items.length > 0) return items;
  }

  return [];
}
```

---

### ⚠️ Pitfall 3: Silent Failures in `listXxx` Functions

The `listCalEventTypes` (and similar wrappers) use a broad `try/catch` that returns `[]`
on any error. This means API-level failures are invisible to the UI — the dropdown just
stays empty with no error feedback.

**Rule:** When an event-type (or similar) fetch returns 0 items after a successful HTTP 200,
the problem is almost always in the extractor, not the connection.

**Debugging procedure:**
1. Add a temporary `console.log` of `result` keys and the truncated payload to the `listXxx` function
2. Run the app, trigger the fetch, check the terminal
3. Map the real response shape → fix the extractor → remove the log

```ts
// Temporary debug pattern (remove after fix)
console.log("[Integration] raw keys:", Object.keys(result ?? {}));
console.log("[Integration] raw (truncated):", JSON.stringify(result).slice(0, 1200));
```

---

### ⚠️ Pitfall 4: `data.eventTypeGroups` — The Cal.com v2 Shape

**This one burned us. Document it permanently.**

`CAL_LIST_EVENT_TYPES` does NOT return a flat `event_types: [...]` array.
The real v2 shape groups event types by team/user:

```json
{
  "data": {
    "allUsersAcrossAllEventTypes": {},
    "eventTypeGroups": [
      {
        "bookerUrl": "https://cal.com",
        "eventTypes": [
          { "id": 42, "title": "30 min meeting", "slug": "30-min-meeting", ... }
        ]
      }
    ]
  },
  "status": "success"
}
```

**Extraction path:** `result.data.eventTypeGroups[n].eventTypes` — flatten across all groups.

The implemented extractor in `src/lib/composio.ts` → `extractCalEventTypes()` handles this
as the primary path before falling back to flat-array buckets.

---

## Known Integration Response Shapes

### Cal.com — `CAL_LIST_EVENT_TYPES`

| Field | Path | Notes |
|-------|------|-------|
| Event types array | `result.data.eventTypeGroups[n].eventTypes` | Flatten across all groups |
| Event type ID | `.id` | **Integer**, not string — coerce with `String(id)` |
| Event type title | `.title` | String |
| Event type slug | `.slug` | String |

Implementation: `extractCalEventTypes()` in `src/lib/composio.ts`

---

### Microsoft Outlook — `OUTLOOK_SEND_EMAIL`

| Field | Path | Notes |
|-------|------|-------|
| Status | `result.success` | Boolean (wrapped by `executeToolCall`) |

*Note: Outlook is currently an action-only tool in the product. It does not have a listing extractor.*

---

### Slack — action tools

Slack is currently a chat action toolkit in the product. Recommended defaults include:

- `SLACK_SEND_MESSAGE`
- `SLACK_SEARCH_MESSAGES`
- `SLACK_FETCH_CONVERSATION_HISTORY`
- `SLACK_FIND_CHANNELS`
- `SLACK_FIND_USERS`

*Note: Slack does not have a product-specific listing extractor yet. The builder uses the shared dynamic action list from `/api/connections/toolkits/[toolkitSlug]/tools`.*

---

### HubSpot — action tools

HubSpot is currently a chat action toolkit in the product. The Composio toolkit slug is `hubspot`, and the current default version is `20260501_00`.

Recommended defaults include:

- `HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA`
- `HUBSPOT_LIST_CONTACTS`
- `HUBSPOT_CREATE_CONTACT`
- `HUBSPOT_UPDATE_CONTACT`
- `HUBSPOT_SEARCH_COMPANIES`
- `HUBSPOT_CREATE_COMPANY`
- `HUBSPOT_UPDATE_COMPANY`
- `HUBSPOT_SEARCH_DEALS`
- `HUBSPOT_CREATE_DEAL`
- `HUBSPOT_UPDATE_DEAL`
- `HUBSPOT_CREATE_TICKET`
- `HUBSPOT_CREATE_NOTE`
- `HUBSPOT_CREATE_TASK`

Do not enable archive/delete/GDPR-permanent-delete tools by default. Operators can opt into additional HubSpot actions through the shared dynamic action list.

*Note: HubSpot does not have a product-specific listing extractor yet. The builder uses the shared dynamic action list from `/api/connections/toolkits/[toolkitSlug]/tools`.*

---

### Shopify — action tools

Shopify is currently a chat action toolkit in the product. The Composio toolkit slug is `shopify`, and the current default version is `20260506_00`.

Composio Managed App is not available for Shopify. The connection flow requires custom Shopify OAuth credentials.

Supported setup modes:

1. Provide a real pre-created Composio auth config id:
   - `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID`
   - or `COMPOSIO_AUTH_CONFIG_SHOPIFY`
2. Or let the app create a custom OAuth2 auth config at connection time:
   - `COMPOSIO_SHOPIFY_CLIENT_ID`
   - `COMPOSIO_SHOPIFY_CLIENT_SECRET`
   - `COMPOSIO_SHOPIFY_OAUTH_REDIRECT_URI`
   - `COMPOSIO_SHOPIFY_SCOPES` (optional; use when scopes should be passed to Composio instead of relying only on the Shopify app version)

The Shopify app redirect URL should match the Composio callback used in env:

```text
https://backend.composio.dev/api/v3/toolkits/auth/callback
```

Do not set `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID=ac_...`; that is only a placeholder and is ignored by the app. A real auth config id must belong to the same Composio project and the Shopify toolkit.

Recommended defaults include:

- `SHOPIFY_GET_SHOP_DETAILS`
- `SHOPIFY_GET_PRODUCTS_PAGINATED`
- `SHOPIFY_COUNT_PRODUCTS`
- `SHOPIFY_LIST_CUSTOMERS`
- `SHOPIFY_CREATE_CUSTOMER`
- `SHOPIFY_UPDATE_CUSTOMER`
- `SHOPIFY_LIST_ORDERS`
- `SHOPIFY_LIST_DRAFT_ORDERS`
- `SHOPIFY_CREATE_DRAFT_ORDER`
- `SHOPIFY_UPDATE_DRAFT_ORDER`
- `SHOPIFY_LIST_INVENTORY_LEVELS`
- `SHOPIFY_CREATES_A_NEW_PRODUCT`
- `SHOPIFY_UPDATES_A_PRODUCT`

Do not enable cancel/refund/delete/charge tools by default. Operators can opt into additional Shopify actions through the shared dynamic action list.

*Note: Shopify does not have a product-specific listing extractor yet. The builder uses the shared dynamic action list from `/api/connections/toolkits/[toolkitSlug]/tools`.*

---

### Google Ads — action tools

Google Ads is currently a chat action toolkit in the product. The Composio toolkit slug is `googleads`, and the current default version is `20260506_00`.

Composio Managed App is available for Google Ads, so the default `use_composio_managed_auth` connection flow works. A real configured auth config id can still be supplied through:

- `COMPOSIO_GOOGLEADS_AUTH_CONFIG_ID`
- or `COMPOSIO_AUTH_CONFIG_GOOGLEADS`

Recommended defaults are intentionally read/search focused:

- `GOOGLEADS_LIST_ACCESSIBLE_CUSTOMERS`
- `GOOGLEADS_GET_CAMPAIGN_BY_ID`
- `GOOGLEADS_GET_CAMPAIGN_BY_NAME`
- `GOOGLEADS_GET_CUSTOMER_LISTS`
- `GOOGLEADS_SEARCH_STREAM_GAQL`

Additional actions exposed by the Composio toolkit can be enabled by operators through the shared action picker:

- `GOOGLEADS_ADD_OR_REMOVE_TO_CUSTOMER_LIST`
- `GOOGLEADS_CREATE_CUSTOMER_LIST`
- `GOOGLEADS_MUTATE_AD_GROUPS`
- `GOOGLEADS_MUTATE_CAMPAIGNS`

Do not enable mutate/customer-list write tools by default. Operators can opt into those actions through the shared dynamic action list when the agent is explicitly allowed to modify Google Ads data.

*Note: Google Ads does not have a product-specific listing extractor yet. The builder uses the shared dynamic action list from `/api/connections/toolkits/[toolkitSlug]/tools`.*

---

### Google Calendar — `GOOGLECALENDAR_LIST_CALENDARS`

| Field | Path | Notes |
|-------|------|-------|
| Calendars array | `result.items` or `result.data.items` | String IDs |
| Calendar ID | `.id` | String |
| Calendar name | `.summary` | String |

Implementation: `extractGoogleCalendarListItems()` in `src/lib/google-calendar.ts`

---

### Google Drive — `GOOGLEDRIVE_FIND_FILE`

| Field | Path | Notes |
|-------|------|-------|
| Files array | `result.files` or `result.data.files` | String IDs |
| Next page token | `result.nextPageToken` | Optional |

Implementation: `extractDriveFileArray()` in `src/lib/composio.ts`

---

## Adding a New Composio Integration — Checklist

Before shipping any new integration, verify each item:

- [ ] **Map the real response shape first** — use the debug log pattern above against a live connection before writing any extractor
- [ ] **Check if IDs are integers** — assume yes, coerce with `String(id)` or the numeric guard pattern
- [ ] **Add the primary bucket path first** — generic fallbacks second
- [ ] **Handle `data` being a JSON string** — parse defensively, don't assume it's always an object
- [ ] **Test with an empty account** — a new/empty connected account should return `[]` gracefully, not throw
- [ ] **Never let the extractor throw** — wrap in try/catch, return `[]` on failure
- [ ] **Add the response shape to this document** under "Known Integration Response Shapes"
- [ ] **Add the tool slug to the architecture.md** for the relevant node section

---

## File Map

| File | Purpose |
|------|---------|
| `src/lib/composio.ts` | All `executeToolCall`, `listXxx` functions, and their extractors |
| `src/lib/cal.ts` | Cal.com frontend types and `extractCalEventTypeListItems` (mirrors composio.ts logic) |
| `src/lib/google-calendar.ts` | Google Calendar frontend types and extractor |
| `src/app/api/connections/toolkits/[toolkitSlug]/tools/route.ts` | Dynamic action list route for chat-surface toolkits |
| `src/app/api/connections/cal/event-types/route.ts` | Cal.com event types API route |
| `src/app/api/connections/googlecalendar/calendars/route.ts` | Google Calendar API route |
| `src/app/api/connections/auth-links/route.ts` | Admin API for creating and listing external auth links |
| `src/app/api/connections/auth-links/[id]/revoke/route.ts` | Admin API for closing pending external auth links |
| `src/app/api/public/connection-auth-links/[token]/start/route.ts` | Public no-login endpoint that starts a Composio auth request from a bearer link |
| `src/app/connect/[token]/page.tsx` | Public recipient page for one integration auth request |
| `src/app/connect/callback/page.tsx` | Public callback page that syncs and completes auth links |
| `src/app/(app)/agents/[id]/builder/page.tsx` | Builder UI — event type dropdown state and fetch effect |
| `src/app/api/agents/[id]/automation/route.ts` | Automation trigger binding save/delete endpoint |
| `src/app/api/agents/[id]/automation/status/route.ts` | Automation trigger activate/pause endpoint |
| `src/app/api/composio/webhook/route.ts` | Composio trigger event ingestion plus connected-account expiry and disabled-trigger handling |
| `src/lib/automation/executor.ts` | Automation event processor that runs the shared agent runtime |

---

## The `flattenEventTypeItems` / `mapItems` Shared Helper Pattern

To avoid duplicated mapping logic between the primary path and the fallback buckets,
extract a shared item mapper and use it in both places:

```ts
// Shared mapper — used by both the primary path and fallback buckets
function flattenEventTypeItems(items: unknown[]): CalEventType[] {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const rawId = record.id ?? record.eventTypeId;
      const id = typeof rawId === "number" && rawId > 0 ? String(rawId) : pickString(rawId);
      const title = pickString(record.title) ?? pickString(record.name);
      const slug = pickString(record.slug);
      if (!id || !title) return null;
      return { id, title, slug: slug ?? "" } satisfies CalEventType;
    })
    .filter(Boolean) as CalEventType[];
}
```

This pattern is implemented in the Cal.com extractor. Follow it for all future integrations.
