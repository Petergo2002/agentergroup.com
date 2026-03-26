# Platform Hardening Plan

## Goal

Implement the highest-priority fixes from the repo-wide audit without widening scope unnecessarily:

1. isolate external connections per workspace
2. prevent preview chat from writing into the wrong thread
3. harden Google Drive import against unsafe external payload fields

## Research Summary

- Connections are documented as workspace-level, but Composio usage was keyed to raw auth user ids.
- Preview chat accepted a client-provided `threadId` without verifying agent ownership.
- Drive import accepted arbitrary URL and file path fields from external tool payloads.

## Design

### 1. Workspace-scoped external connection identity

- Introduce a shared helper that builds a stable Composio user key from `workspace_id + created_by`.
- Persist that key in `connections.toolkit_data.composioUserId`.
- Treat any connection row without the expected key as effectively disconnected.
- Update connection auth/sync/disconnect, Google Calendar listing, Drive browsing/import, and runtime tool execution to use the scoped key.
- Avoid deleting external connected accounts for stale legacy rows; delete only the local DB row in that case.

### 2. Preview thread validation

- When preview chat receives `threadId`, load the thread and require:
  - `id === threadId`
  - `agent_id === current agent id`
  - `workspace_id === current agent workspace`
  - `created_by === current user id`
- Reject invalid thread ids with a `404` before creating runs or messages.

### 3. Drive import hardening

- Remove support for local file path reads from Composio payloads.
- Accept inline content directly.
- Allow remote file fetches only for `https` URLs on explicit safe host patterns typically used for signed object delivery.
- Reject loopback, private-network, and malformed URLs.

## File Changes

- `src/lib/connections.ts`
- `src/lib/types.ts`
- `src/lib/composio.ts`
- `src/lib/runtime/agent-chat.ts`
- `src/app/api/connections/authorize/route.ts`
- `src/app/api/connections/toolkits/route.ts`
- `src/app/api/connections/disconnect/route.ts`
- `src/app/api/connections/googlecalendar/calendars/route.ts`
- `src/app/api/knowledge/drive/files/route.ts`
- `src/app/api/knowledge/drive/import/route.ts`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
- `src/app/(app)/agents/[id]/builder/page.tsx`
- `docs/architecture.md`

## Edge Cases

- Existing legacy connection rows become stale unless reconnected with the new scoped identity.
- Legacy stale rows should not trigger destructive disconnects against shared external accounts.
- Preview chat should still create a new thread automatically when no `threadId` is provided.
- Drive import should fail closed if the payload shape is unexpected.

## Verification

- Run `npm run build`.
- Run `npm run widget:build`.
- Manually verify:
  - connection pages show legacy stale rows as disconnected
  - preview chat rejects cross-agent thread ids
  - Drive browsing/import still works with scoped identity and safe payload handling
