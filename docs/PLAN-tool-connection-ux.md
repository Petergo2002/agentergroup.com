# Tool Connection UX — Simplify to One-Account-Per-Toolkit

## Problem

Every tool node in the Agent Builder (Gmail, Outlook, Google Calendar, Cal.com) currently shows a **"Connected Account" `<select>` dropdown** that lets users pick from multiple accounts per toolkit. This causes two problems:

1. **Conceptually wrong** — We only ever want one connected account per toolkit per workspace. Having a multi-account picker implies a flexibility we don't support and creates confusion.
2. **Visually poor** — A native `<select>` element doesn't match our premium dark UI. The label and account label (`default`, `peter@...`) are displayed as a raw dropdown option, not in a clean display chip.

---

## Goal

- **Enforce one account per toolkit per workspace** — both at the DB level (upsert logic) and at the UI level (no dropdown).
- **Replace the `<select>` with a clean read-only "Connected Account" display card** — showing the email / account label nicely styled.
- **Auto-select the one connected account** — when the tool node is added to the canvas, auto-assign the single available connection.
- **Keep the "Go to Connections" link** for when no account is connected.

> [!IMPORTANT]
> This does NOT remove the ability to reconnect. The **Connections page** remains the place to manage (connect / disconnect / reconnect) accounts. The Builder just displays what's connected.

---

## Open Questions (Resolved by codebase review)

> 1. **Is one-account-per-toolkit already enforced in DB?**  
>    Partially. The upsert conflict key is `workspace_id, toolkit_slug, account_label`. If two accounts for the same toolkit have different labels, they both get stored. We'll tighten this.
>
> 2. **Can `account_label` carry the email?**  
>    Yes — `normalizeConnectedAccount()` in `composio.ts` picks `item.accountName ?? item.connectionName ?? item.authConfig?.name ?? "default"`. Composio typically returns the Gmail address as `accountName`. So `account_label` already contains the email.
>
> 3. **Which surfaces show the dropdown?**  
>    - `builder/page.tsx` → Tool node panel (`<select>` at line ~3477)  
>    - `builder/page.tsx` → Automation trigger panel (`<select>` at line ~2948)  
>    - `KnowledgePageClient.tsx` → Drive source — already read-only label, no change needed.

---

## Proposed Changes

### 1 — Database / Backend: Enforce One Account Per Toolkit

#### [MODIFY] `src/lib/composio.ts`
- Change `upsert` conflict key from `workspace_id,toolkit_slug,account_label` → `workspace_id,toolkit_slug`.
- This means if a new account is synced for the same toolkit, it **overwrites** the existing row.

#### [MODIFY] `src/app/api/connections/authorize/route.ts`
- Same conflict key change: `workspace_id,toolkit_slug`.

#### [NEW] `supabase/migrations/YYYYMMDD_connections_one_per_toolkit.sql`
> [!WARNING]
> **DB migration required.** Drop the old unique index on `(workspace_id, toolkit_slug, account_label)` and add a new one on `(workspace_id, toolkit_slug)`. Non-destructive if each workspace already has ≤ 1 account per toolkit.

---

### 2 — Builder UI: Replace Dropdown with Display Card

#### [MODIFY] `src/app/(app)/agents/[id]/builder/page.tsx`

**Tool node panel** (around line 3470–3511) — replace `<select>` block with a read-only display card.

Visual design for `ConnectedAccountDisplay`:

```
┌─────────────────────────────────────┐
│  CONNECTED ACCOUNT                  │
│                                     │
│  [●] peter@example.com              │  ← green dot + bold email
│      Connected                      │  ← muted status text
│                                     │
└─────────────────────────────────────┘
```

States:
- ✅ **Connected** → green dot + email/label, no action link.
- ⚠️ **Pending/Error** → yellow/red dot + "Fix in Connections →" link.
- ⭕ **None** → dashed empty state + "Connect in Connections →" link.

**Automation trigger panel** (around line 2942–2978) — same treatment for the `gmail_new_message` trigger.

**Simplify** `getSelectableConnections()` → replace with `getSingleConnection(connections, kind)` that just returns the first `connected` record for a toolkit.

---

### 3 — Builder Logic: Auto-Wire the Connection

#### [MODIFY] `src/app/(app)/agents/[id]/builder/page.tsx`

After connections are loaded, auto-assign the connected account to any tool node whose `connectionId` is `null`:

```
For each tool node (gmail/outlook/googlecalendar/cal):
  if node.data.connectionId === null:
    find connections where toolkit_slug === kind && status === 'connected'
    if found: updateToolConnection(node.id, found.id)
```

This makes the builder feel zero-config: add a Gmail tool and it's automatically wired if Gmail is connected.

---

### 4 — ConnectedAccountDisplay Component

Small inline component living in `builder/page.tsx`:

| Prop | Type |
|------|------|
| `connection` | `ConnectionRecord \| null` |
| `toolkitLabel` | `string` |
| `onGoToConnections` | link to `/connections` |

Design tokens: `rounded-[1.5rem]`, `border border-outline-variant/10`, `bg-surface-container-lowest`, green/yellow/red status dot, `text-sm font-bold` for the account label.

---

## Verification Plan

### Build & Lint
```bash
npm run build   # zero type errors
npm run lint    # zero new warnings
```

### Manual Verification Checklist
1. Connect Gmail in `/connections` → open Builder → add Gmail node → **auto-selected, shown as card** (no dropdown).
2. Disconnect Gmail → return to Builder → tool node shows **warning card** with "Fix in Connections" link.
3. Check DB: `connections` table has at most **one row** per `(workspace_id, toolkit_slug)`.
4. Automation trigger node with `gmail_new_message` → shows **read-only display card** (not dropdown).

---

## Implementation Order

| Step | Task | File |
|------|------|------|
| 1 | Supabase migration — tighten unique index | `supabase/migrations/…_connections_one_per_toolkit.sql` |
| 2 | Backend upsert conflict key | `composio.ts`, `authorize/route.ts` |
| 3 | `ConnectedAccountDisplay` component | `builder/page.tsx` |
| 4 | Replace tool node `<select>` | `builder/page.tsx` ~L3470 |
| 5 | Replace trigger `<select>` | `builder/page.tsx` ~L2942 |
| 6 | Auto-wire logic on connection load | `builder/page.tsx` useEffect |
| 7 | Clean up `getSelectableConnections` → `getSingleConnection` | `builder/page.tsx` ~L1352 |
