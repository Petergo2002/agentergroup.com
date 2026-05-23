import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveToolNodeConnection,
  type ToolConnectionNodeData,
} from "../../src/lib/builder-connection-resolver.ts";
import type { ConnectionRecord } from "../../src/lib/types/connection.ts";

function connection(
  overrides: Partial<ConnectionRecord> & Pick<ConnectionRecord, "id" | "toolkit_slug">,
): ConnectionRecord {
  return {
    id: overrides.id,
    workspace_id: overrides.workspace_id ?? "workspace-a",
    provider: overrides.provider ?? "composio",
    toolkit_slug: overrides.toolkit_slug,
    display_name: overrides.display_name ?? overrides.toolkit_slug,
    status: overrides.status ?? "connected",
    external_id: overrides.external_id ?? `ca_${overrides.id}`,
    account_label: overrides.account_label ?? "default",
    toolkit_data: overrides.toolkit_data ?? {
      composioUserId: "workspace:workspace-a",
    },
    created_by: overrides.created_by ?? "user-a",
    last_synced_at: overrides.last_synced_at ?? null,
    created_at: overrides.created_at ?? "2026-05-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-05-01T00:00:00.000Z",
  };
}

test("binds a null tool connection id to the connected toolkit account", () => {
  const data = {
    kind: "gmail",
    label: "Gmail",
    integrationSlug: "gmail",
    connectionId: null,
    recipientMode: "ai_decides",
    recipientEmail: null,
  } satisfies ToolConnectionNodeData;

  const resolved = resolveToolNodeConnection(data, [
    connection({ id: "conn-gmail", toolkit_slug: "gmail" }),
  ]);

  assert.equal(resolved.data.connectionId, "conn-gmail");
  assert.equal(resolved.selectedConnection?.id, "conn-gmail");
  assert.equal(resolved.changed, true);
});

test("rebinds a stale tool connection id to the connected toolkit account", () => {
  const data = {
    kind: "slack",
    label: "Slack",
    integrationSlug: "slack",
    connectionId: "deleted-connection",
  } satisfies ToolConnectionNodeData;

  const resolved = resolveToolNodeConnection(data, [
    connection({ id: "conn-slack", toolkit_slug: "slack" }),
  ]);

  assert.equal(resolved.data.connectionId, "conn-slack");
  assert.equal(resolved.selectedConnection?.id, "conn-slack");
});

test("rejects a wrong-toolkit connection id and rebinds to the current toolkit", () => {
  const data = {
    kind: "hubspot",
    label: "HubSpot",
    integrationSlug: "hubspot",
    connectionId: "conn-slack",
  } satisfies ToolConnectionNodeData;

  const resolved = resolveToolNodeConnection(data, [
    connection({ id: "conn-slack", toolkit_slug: "slack" }),
    connection({ id: "conn-hubspot", toolkit_slug: "hubspot" }),
  ]);

  assert.equal(resolved.data.connectionId, "conn-hubspot");
  assert.equal(resolved.selectedConnection?.toolkit_slug, "hubspot");
});

test("clears Google Calendar account-specific settings when account changes", () => {
  const data = {
    kind: "googlecalendar",
    label: "Google Calendar",
    integrationSlug: "googlecalendar",
    connectionId: "stale-calendar",
    timezone: "Europe/Stockholm",
    calendarId: "team@example.com",
    calendarLabel: "Team",
    includePrimaryCalendar: true,
  } satisfies ToolConnectionNodeData;

  const resolved = resolveToolNodeConnection(data, [
    connection({ id: "conn-calendar", toolkit_slug: "googlecalendar" }),
  ]);

  assert.equal(resolved.data.connectionId, "conn-calendar");
  assert.equal(resolved.data.timezone, null);
  assert.equal(resolved.data.calendarId, null);
  assert.equal(resolved.data.calendarLabel, null);
  assert.equal(resolved.data.includePrimaryCalendar, true);
});

test("clears Cal.com account-specific settings when account changes", () => {
  const data = {
    kind: "cal",
    label: "Cal.com",
    integrationSlug: "cal",
    connectionId: "stale-cal",
    eventTypeMode: "specific_event_type",
    eventTypeId: "42",
    eventTypeLabel: "Intro Call",
    timezone: "Europe/Stockholm",
  } satisfies ToolConnectionNodeData;

  const resolved = resolveToolNodeConnection(data, [
    connection({ id: "conn-cal", toolkit_slug: "cal" }),
  ]);

  assert.equal(resolved.data.connectionId, "conn-cal");
  assert.equal(resolved.data.timezone, null);
  assert.equal(resolved.data.eventTypeId, null);
  assert.equal(resolved.data.eventTypeLabel, null);
  assert.equal(resolved.data.eventTypeMode, "specific_event_type");
});
