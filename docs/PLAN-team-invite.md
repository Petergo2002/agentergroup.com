# PLAN: Team Invite & Multi-Workspace Collaboration

## Goal

Replace the **hardcoded mock** Team page with a fully functional invite system.
When a user is invited, they join the workspace as an **admin** (full access).
If the invited user already has an Agentergroup account, the new workspace appears in their workspace switcher.
When viewing a workspace you don't own, the UI clearly communicates **"you are a guest here"**.

---

## Current State (Research Summary)

| Layer | Current | What Needs to Change |
|-------|---------|---------------------|
| **DB Schema** | `workspace_members` exists with `role` enum `owner/admin/member`. No invite table. | Add `workspace_invites` table. |
| **Team Page** | Hardcoded `TEAM_MEMBERS` array (fake data). "Invite member" button does nothing. | Real data from DB + working invite modal. |
| **RLS Policies** | `workspace_members_self_insert` only allows owner. No invite-based insert. | Add policy for invite acceptance flow. |
| **App Context** | `AppWorkspaceContext` exposes `workspaces[]` and `membership`. | Add `isOwner` helper. No structural change needed. |
| **Sidebar** | Shows user role as badge. No "guest workspace" indicator. | Add visual indicator when `membership.role !== 'owner'`. |
| **Workspace Switcher** | Cookie-based (`active_workspace_id`). Already supports multi-workspace. | ✅ Works as-is. Invited workspaces auto-appear. |

---

## Database Schema

### New Table: `workspace_invites`

```sql
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, email, status)
);

-- Indexes
create index if not exists workspace_invites_token_idx on public.workspace_invites (token) where status = 'pending';
create index if not exists workspace_invites_email_idx on public.workspace_invites (email) where status = 'pending';
create index if not exists workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);

-- RLS
alter table public.workspace_invites enable row level security;

-- Members of the workspace can see invites
drop policy if exists "workspace_invites_member_select" on public.workspace_invites;
create policy "workspace_invites_member_select"
on public.workspace_invites for select
using (public.is_workspace_member(workspace_id));

-- Owner/admin can create invites
drop policy if exists "workspace_invites_admin_insert" on public.workspace_invites;
create policy "workspace_invites_admin_insert"
on public.workspace_invites for insert
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);

-- Owner/admin can revoke invites
drop policy if exists "workspace_invites_admin_update" on public.workspace_invites;
create policy "workspace_invites_admin_update"
on public.workspace_invites for update
using (
  exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);

-- Owner/admin can delete invites
drop policy if exists "workspace_invites_admin_delete" on public.workspace_invites;
create policy "workspace_invites_admin_delete"
on public.workspace_invites for delete
using (
  exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = workspace_invites.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
  )
);
```

### Updated RLS: Allow invite-based workspace_members insert

The current `workspace_members_self_insert` policy only allows the workspace owner to insert members. We need a **new separate policy** for the acceptance flow (server-side, with service role):

> **Decision:** The invite acceptance API route will use the **Supabase service role client** to insert the membership row. This avoids complex RLS gymnastics and is the industry-standard pattern (Slack, Linear, Notion all do this server-side).

No RLS policy change needed — the service role client bypasses RLS.

---

## API Routes

### 1. `POST /api/workspaces/[id]/invites` — Send Invite

**Auth:** Must be owner or admin of the workspace.

**Request Body:**
```json
{ "email": "colleague@company.com" }
```

**Logic:**
1. Validate email format.
2. Check if user is already a member → error.
3. Check if there's already a pending invite for this email → error.
4. Insert into `workspace_invites`.
5. Send invite email via Supabase `auth.admin` or a transactional email service.
   - Email contains link: `{APP_URL}/invite/accept?token={invite.token}`
   - If no email service is configured yet, still create the invite and return the link (copyable from UI).

**Response:** `{ invite: InviteRecord }`

### 2. `GET /api/workspaces/[id]/invites` — List Invites

**Auth:** Must be member of the workspace.

**Response:** `{ invites: InviteRecord[] }` (pending + recently accepted)

### 3. `DELETE /api/workspaces/[id]/invites/[inviteId]` — Revoke Invite

**Auth:** Must be owner or admin.

**Logic:** Set `status = 'revoked'`.

### 4. `POST /api/invites/accept` — Accept Invite

**Auth:** Must be logged in (any authenticated user).

**Request Body:**
```json
{ "token": "uuid-token-from-email-link" }
```

**Logic:**
1. Look up invite by `token` where `status = 'pending'` and `expires_at > now()`.
2. Verify the authenticated user's email matches `invite.email` (case-insensitive).
3. Using **service role client**: insert into `workspace_members` with `role = invite.role`.
4. Update invite `status = 'accepted'`.
5. Set `active_workspace_id` cookie to the new workspace.
6. Return the workspace info so UI can redirect.

### 5. `GET /api/workspaces/[id]/members` — List Members

**Auth:** Must be member of the workspace.

**Logic:** Join `workspace_members` with `profiles` to return name, email, avatar, role.

### 6. `DELETE /api/workspaces/[id]/members/[memberId]` — Remove Member

**Auth:** Must be owner. Cannot remove yourself if you're the only owner.

**Logic:** Delete the `workspace_members` row.

---

## Frontend Changes

### 1. Team Settings Page (`/settings/team/page.tsx`) — Full Rewrite

Replace hardcoded array with real data:

**State:**
- `members[]` — fetched from `GET /api/workspaces/[id]/members`
- `pendingInvites[]` — fetched from `GET /api/workspaces/[id]/invites`
- `inviteEmail` — input state for the invite modal
- `isInviting` — loading state

**Sections:**
1. **Header** — "Team" title + "Invite member" button
2. **Members Table** — Real members with avatar, name, email, role badge, remove action
3. **Pending Invites** — Shows email, status pill ("Pending"), copy-link action, revoke action

**Invite Modal:**
- Simple modal with single email input
- Validates email format client-side
- On submit: `POST /api/workspaces/[id]/invites`
- Success: toast + refresh invite list
- Option to copy the invite link directly (for cases where email isn't configured)

### 2. Invite Accept Page (`/invite/accept/page.tsx`) — New Page

**Route:** `/invite/accept?token=<uuid>`

**Logic:**
1. If not logged in → redirect to `/auth/login?redirect=/invite/accept?token=<uuid>`
2. If logged in → call `POST /api/invites/accept` with the token
3. On success → redirect to `/dashboard` (now in the new workspace)
4. On error (expired, wrong email, already member) → show friendly error

### 3. Sidebar Guest Indicator

When `membership.role !== 'owner'`, show a visual indicator in the sidebar:

```
┌─────────────────────┐
│  🏢 Acme Corp       │  ← workspace name
│  👤 GUEST · ADMIN   │  ← role indicator (not "owner")
│                     │
│  ⚡ Switch to yours │  ← quick link back to own workspace
└─────────────────────┘
```

**Implementation:** In `Sidebar.tsx`, below the user card, add a conditional banner:
- Condition: `membership.role !== 'owner'`
- Visual: Subtle info-bar with workspace name and a "Switch workspace" dropdown
- Style: `bg-info-container/30` with `ring-1 ring-info/20` border

### 4. Workspace Switcher Enhancement

The existing workspace switcher (cookie-based) already works for multi-workspace.
When the invited user accepts, `loadWorkspaceMemberships()` in `bootstrap.ts` will automatically pick up the new workspace since it queries `workspace_members` by `user_id`.

**Small enhancement:** Add a workspace name + indicator in the sidebar's bottom user card showing which workspace is currently active, especially useful when a user has 2+ workspaces.

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Invite token guessing** | UUID v4 tokens = 122 bits of entropy. Combined with email check, practically unguessable. |
| **Cross-email acceptance** | Server verifies `auth.user.email === invite.email`. Cannot accept someone else's invite. |
| **Privilege escalation** | Role is locked to `admin` in the `check` constraint. No path to `owner` via invite. |
| **Expired invites** | 7-day TTL enforced in both DB default and API validation. |
| **Self-invite** | API checks if email is already a member before creating invite. |
| **Owner removal** | API prevents removing the last owner of a workspace. |

---

## File Inventory

| Action | Path | Description |
|--------|------|-------------|
| **[NEW]** | `supabase/migrations/YYYYMMDD_team_invites.sql` | DB migration (run manually) |
| **[NEW]** | `src/app/api/workspaces/[id]/invites/route.ts` | POST (create) + GET (list) |
| **[NEW]** | `src/app/api/workspaces/[id]/invites/[inviteId]/route.ts` | DELETE (revoke) |
| **[NEW]** | `src/app/api/workspaces/[id]/members/route.ts` | GET (list members) |
| **[NEW]** | `src/app/api/workspaces/[id]/members/[memberId]/route.ts` | DELETE (remove member) |
| **[NEW]** | `src/app/api/invites/accept/route.ts` | POST (accept invite) |
| **[NEW]** | `src/app/(app)/invite/accept/page.tsx` | Accept invite UI page |
| **[REWRITE]** | `src/app/(app)/settings/team/page.tsx` | Real team page |
| **[MODIFY]** | `src/components/layout/Sidebar.tsx` | Guest indicator |
| **[MODIFY]** | `src/lib/types.ts` | Add `WorkspaceInviteRecord` type |
| **[MODIFY]** | `src/locales/en.ts` | English strings |
| **[MODIFY]** | `src/locales/sv.ts` | Swedish strings |

---

## Execution Order

1. **Schema first** — User runs migration SQL manually in Supabase dashboard
2. **Types** — Add `WorkspaceInviteRecord` to `types.ts`
3. **API routes** — Members list → Invites CRUD → Accept flow
4. **Team page** — Full rewrite with real data
5. **Accept page** — New route for invite links
6. **Sidebar** — Guest indicator
7. **Locales** — Both EN + SV

---

## Verification Plan

### Manual Testing
1. Owner invites email → invite appears in pending list
2. Copy invite link → open in incognito → login with that email → workspace appears
3. Try to accept with wrong email → error
4. Try expired invite → error
5. Remove a member → they lose access
6. Switch between owned and guest workspaces → sidebar indicator changes
7. Guest user sees "Impersonating" / "Guest" indicator in sidebar

### Edge Cases
- Invite an email that doesn't have an account yet → they sign up → accept → workspace appears
- Invite same email twice → error "already invited"
- Remove yourself from a workspace you don't own → allowed (leave workspace)
- Owner cannot be removed by admin → enforced
