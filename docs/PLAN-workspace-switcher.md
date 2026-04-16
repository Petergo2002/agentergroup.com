# Plan: Workspace Switcher & Context Indicators

## Goal
Enable users who belong to multiple workspaces to seamlessly switch between them using a UI component. Additionally, provide clear contextual indicators on the "Team" settings page when a user is operating in a workspace they do not own.

## User Review Required
> [!IMPORTANT]  
> The proposed workspace switcher will replace the static user account "card" at the bottom of the sidebar with an interactive dropdown menu. When clicked, it will show the active workspace, a list of other available workspaces, and the sign-out option. Is this structural change to the sidebar acceptable?

## Proposed Changes

---

### 1. Unified Workspace Switcher (Sidebar)

**Objective**: Allow users to see all their available workspaces and switch contexts.

#### [MODIFY] src/components/layout/Sidebar.tsx
- **Current State**: Bottom user card is static, showing initials, email, and role. It reveals a tiny logout button on hover.
- **New Logic**:
  - Convert the bottom `div` into a `<summary>`/`<details>` or a Radix UI / headless UI custom dropdown (or use a simple state-based absolute overlay since we use raw Tailwind here).
  - Add an explicit "chevron-up" icon to indicate it's a menu.
  - Clicking the card opens a popover `div`.
  - The popover lists all entries from `appContext.workspaces`.
  - The current workspace gets a green checkmark.
  - The other workspaces are clickable.
  - Clicking an inactive workspace triggers an `await fetch('/api/workspaces/active', { method: 'POST', body: JSON.stringify({ workspaceId: id }) })` followed by `window.location.href = '/'` to force a clean re-mount of the entire app context.
  - The `Sign Out` button is moved inside this menu.

---

### 2. Team Settings Context Clarity

**Objective**: Make it abundantly clear to a guest user when they are viewing a team they do not own, right on the settings page.

#### [MODIFY] src/app/(app)/settings/team/page.tsx
- **Current State**: We have "TEAM / Team members". We added the "Incoming Invites" section. We also added a small sidebar indicator.
- **New Logic**:
  - Add a dedicated banner right below the page header:
    ```tsx
    if (membership.role !== 'owner') {
      <div className="bg-surface-container/50 border border-outline-variant ...">
        "You are participating in this workspace as a {role}. The workspace is owned by {workspace owner name/email}. You cannot delete it."
      </div>
    }
    ```
  - Fetch the workspace owner's info from the `members` list (where `role === 'owner'`) to dynamically say who owns it.
  - Ensure the "Invite member" button is still visible for `admin`s (which is already implemented, but we clarify the UX).

---

### 3. Localization Updates

**Objective**: Ensure the new switcher and banners support English and Swedish.

#### [MODIFY] src/locales/en.ts & src/locales/sv.ts
- `nav`: Add `switchWorkspace: "Switch Workspace"`.
- `team`: Add `guestBannerTitle: "Guest Access"`, `guestBannerText: "You are participating in {workspaceName} as a {role}. This workspace is owned by {ownerName}."`.

---

## Open Questions
> [!NOTE]  
> 1. Should the Workspace Switcher also include the "Create new workspace" button right inside the menu? (Currently, workspace creation is only available via the `/settings` general page).
> 2. Does the Sidebar `Guest Workspace` orange indicator feel redundant if we add the explicit banner to the Team settings, or do you want to keep both so it's always visible anywhere in the app?

## Verification Plan

### Automated Tests
- TypeScript compilation to ensure `appContext.workspaces` is correctly iterated.

### Manual Verification
1. Log in with an account that has 2 workspaces.
2. Click the bottom-left sidebar user card.
3. Validate the popover menu opens and lists both workspaces cleanly.
4. Click the second workspace. Verify the app reloads and the sidebar contexts update.
5. Go to `Settings > Team`. Verify the "Guest access" banner appears showing the owner's name.
