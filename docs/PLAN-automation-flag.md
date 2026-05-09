# Automation Feature Flag — Admin-Controlled Beta Gate

## Goal

The **Automation** surface (trigger-based agents) is in beta. It must be **completely invisible and inaccessible** to a workspace unless an admin explicitly enables it from the admin panel — exactly the same pattern as **Internal Assistants**.

---

## How Internal Assistants Does It (Reference Pattern)

| Layer | What it does |
|-------|-------------|
| DB | `workspaces.internal_assistants_enabled boolean default false` |
| Types | `WorkspaceRecord.internal_assistants_enabled: boolean` |
| Helper | `hasInternalAssistantsEnabled(workspace)` in `feature-flags.ts` |
| Bootstrap | Column included in workspace select in `bootstrap.ts` |
| Admin API | `PATCH /api/admin/workspaces/[id]/internal-assistants` |
| Admin UI | `AdminInternalAssistantsToggle` component |
| Admin page | Toggle rendered in workspace detail customer tab |
| Create modal | "Assistant" option hidden unless flag on |
| Builder | Redirect to `/agents` if flag off and agent is `assistant` surface |
| Agent list/dashboard | Filter out `assistant` agents if flag off |

We replicate **all of the above** for `automation`.

---

## Proposed Changes

### 1 — Database

#### [NEW] `supabase/migrations/20260507_automations_feature_flag.sql`

```sql
-- Add automations_enabled flag to workspaces (default off = beta gated)
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS automations_enabled boolean NOT NULL DEFAULT false;
```

> [!NOTE]
> No data migration needed — all existing workspaces default to `false` (automation hidden).

---

### 2 — Types

#### [MODIFY] `src/lib/types/workspace.ts`
Add `automations_enabled: boolean` to `WorkspaceRecord`.

---

### 3 — Feature Flag Helper

#### [MODIFY] `src/lib/assistants/feature-flags.ts`

Add two new exports alongside the existing assistants helpers:

```typescript
export function hasAutomationsEnabled(workspace) {
  return workspace?.automations_enabled === true;
}

export function isAutomationBlocked(agent, workspace) {
  return agent.surface === 'automation' && !hasAutomationsEnabled(workspace);
}
```

---

### 4 — Bootstrap Query

#### [MODIFY] `src/lib/app/bootstrap.ts`

Add `automations_enabled` to the workspace select string (line 163):

```
"...internal_assistants_enabled, automations_enabled, onboarding_completed"
```

---

### 5 — Admin API Route

#### [NEW] `src/app/api/admin/workspaces/[id]/automations/route.ts`

`PATCH` handler — mirrors `/internal-assistants/route.ts` exactly:
- Auth check: must be admin user
- Body: `{ enabled: boolean }`
- Updates `workspaces.automations_enabled`
- Returns `{ workspace: { id, automationsEnabled } }`

---

### 6 — Admin UI Toggle Component

#### [NEW] `src/components/admin/AdminAutomationsToggle.tsx`

Clone of `AdminInternalAssistantsToggle.tsx` with:
- Calls `/api/admin/workspaces/[id]/automations`
- Label: "Automations (Beta)"
- Description: "Allow this workspace to create and use automation trigger agents."

---

### 7 — Admin Panel Integration

#### [MODIFY] `src/lib/admin/queries.ts`

- Add `automations_enabled?: boolean` to `WorkspaceRow` type
- Include `automations_enabled` in the `getWorkspaceDetail` select query (line 231)
- Map `automationsEnabled: workspace.automations_enabled === true` in the return object (line 352)

#### [MODIFY] `src/lib/admin/types.ts` (if exists) / inline type
Add `automationsEnabled: boolean` to `AdminWorkspaceDetailData.workspace`.

#### [MODIFY] `src/app/(admin)/admin/workspaces/[id]/page.tsx`

Import `AdminAutomationsToggle` and render it in the customer tab grid alongside `AdminInternalAssistantsToggle`:

```tsx
<AdminAutomationsToggle
  workspaceId={workspace.id}
  enabled={workspace.automationsEnabled}
/>
```

---

### 8 — Create Agent Modal Gate

#### [MODIFY] `src/components/modals/CreateAgentModal.tsx`

Wrap the `automation` surface option the same way `assistant` is wrapped:

```tsx
// Before (always shown):
{ surface: 'automation', title: '...', ... }

// After (only when flag on):
...(automationsEnabled ? [{ surface: 'automation', ... }] : [])
```

Also add guard in `handleCreate`:
```tsx
if (surface === 'automation' && !automationsEnabled) {
  showToast('Automations are not enabled for this workspace.', 'error');
  return;
}
```

---

### 9 — Agent Builder Redirect Gate

#### [MODIFY] `src/app/(app)/agents/[id]/builder/page.tsx`

Mirror the existing `isInternalAssistantBlocked` check. When the agent surface is `automation` and flag is off, redirect to `/agents` (same pattern used for assistants around line 2036).

---

### 10 — Agent List & Dashboard Filtering

#### [MODIFY] `src/app/(app)/agents/page.tsx`
Filter out `automation` surface agents if `automations_enabled` is false (mirrors line 29 pattern).

#### [MODIFY] `src/app/(app)/dashboard/page.tsx`
Same filter (mirrors line 87 pattern).

#### [MODIFY] `src/app/api/dashboard/summary/route.ts`
Same filter in the summary API (mirrors line 92 pattern).

---

## Migration SQL (Ready to Run)

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS automations_enabled boolean NOT NULL DEFAULT false;
```

---

## Verification Plan

### Build
```bash
npx tsc --noEmit   # zero errors
npm run build      # clean build
```

### Manual Checklist

| Test | Expected |
|------|----------|
| New workspace (flag off) | "Automation" option **invisible** in Create Agent modal |
| Direct URL to automation builder | Redirected to `/agents` |
| Admin panel → enable automations | Toggle turns on |
| After enable → modal | "Automation" option appears |
| After enable → builder | Accessible |
| Disable again from admin | Option disappears again |

---

## Implementation Order

| Step | File | Notes |
|------|------|-------|
| 1 | Migration SQL | User runs in Supabase |
| 2 | `workspace.ts` types | Add field |
| 3 | `feature-flags.ts` | Add helpers |
| 4 | `bootstrap.ts` | Add to select string |
| 5 | `admin/queries.ts` | Add to select + map |
| 6 | Admin API route | New file |
| 7 | Admin toggle component | New file |
| 8 | Admin page | Wire toggle |
| 9 | Create Agent Modal | Hide automation option |
| 10 | Builder page | Redirect gate |
| 11 | Agent list + dashboard | Filter gate |
