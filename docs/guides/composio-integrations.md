# Composio Integrations — Implementation Guide

Last updated: 2026-05-04

This document is the mandatory reference for building and debugging Composio tool integrations
in this codebase. Read this before writing any new integration. All lessons here were earned
through production debugging.

---

## Architecture Overview

Composio is used in two product paths:

1. connected action tools used by chat and automation runtimes
2. external trigger webhooks used by Automation agents

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

### External trigger webhooks

Automation triggers use a different path:

```text
Composio trigger
  -> POST /api/composio/webhook
  -> verifyWebhook(...) with COMPOSIO_WEBHOOK_SECRET
  -> lookup agent_automations by composio_trigger_id
  -> insert automation_events
  -> processAutomationEvent(...)
```

Current v1 trigger support:

- `GMAIL_NEW_GMAIL_MESSAGE`

Trigger creation/enabling/disabling/deletion is owned by:

- `src/app/api/agents/[id]/automation/status/route.ts`
- `src/app/api/agents/[id]/automation/route.ts`
- `src/lib/composio.ts`

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
| `src/app/api/connections/cal/event-types/route.ts` | Cal.com event types API route |
| `src/app/api/connections/googlecalendar/calendars/route.ts` | Google Calendar API route |
| `src/app/(app)/agents/[id]/builder/page.tsx` | Builder UI — event type dropdown state and fetch effect |
| `src/app/api/agents/[id]/automation/route.ts` | Automation trigger binding save/delete endpoint |
| `src/app/api/agents/[id]/automation/status/route.ts` | Automation trigger activate/pause endpoint |
| `src/app/api/composio/webhook/route.ts` | Composio trigger webhook verification and event ingestion |
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
