import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultGoogleCalendarSelection,
  extractGoogleCalendarSelectionFromNodes,
} from "../../src/lib/google-calendar.ts";
import { agentBuilder as agentBuilderEn } from "../../src/locales/en/agentBuilder.ts";
import { agentBuilder as agentBuilderSv } from "../../src/locales/sv/agentBuilder.ts";
import type { GoogleCalendarBuilderNodeData } from "../../src/lib/types/builder.ts";

type TestNode = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: Partial<GoogleCalendarBuilderNodeData>;
};

test("Google Calendar selection defaults meeting duration to 30 minutes", () => {
  const defaultSelection = buildDefaultGoogleCalendarSelection();
  assert.equal(defaultSelection.meetingDurationMinutes, 30);
});

test("extractGoogleCalendarSelectionFromNodes extracts configured meeting duration", () => {
  const nodes: TestNode[] = [
    {
      id: "googlecalendar",
      type: "agentNode",
      position: { x: 610, y: 570 },
      data: {
        kind: "googlecalendar",
        label: "Google Calendar",
        type: "Tool",
        icon: "calendar_month",
        connectionId: "conn_123",
        calendarId: "cal_456",
        calendarLabel: "Sales Calendar",
        timezone: "Europe/Stockholm",
        includePrimaryCalendar: true,
        meetingDurationMinutes: 45,
      },
    },
  ];

  const selection = extractGoogleCalendarSelectionFromNodes(nodes);
  assert.equal(selection.meetingDurationMinutes, 45);
  assert.equal(selection.calendarId, "cal_456");
  assert.equal(selection.timezone, "Europe/Stockholm");
  assert.equal(selection.includePrimaryCalendar, true);
});

test("extractGoogleCalendarSelectionFromNodes defaults to 30 minutes when duration is missing or invalid", () => {
  const nodesWithoutDuration: TestNode[] = [
    {
      id: "googlecalendar",
      type: "agentNode",
      position: { x: 610, y: 570 },
      data: {
        kind: "googlecalendar",
        label: "Google Calendar",
        type: "Tool",
        icon: "calendar_month",
        connectionId: "conn_123",
      },
    },
  ];

  const selection1 = extractGoogleCalendarSelectionFromNodes(nodesWithoutDuration);
  assert.equal(selection1.meetingDurationMinutes, 30);

  const nodesWithInvalidDuration: TestNode[] = [
    {
      id: "googlecalendar",
      type: "agentNode",
      position: { x: 610, y: 570 },
      data: {
        kind: "googlecalendar",
        label: "Google Calendar",
        type: "Tool",
        icon: "calendar_month",
        connectionId: "conn_123",
        meetingDurationMinutes: 0 as unknown as number,
      },
    },
  ];

  const selection2 = extractGoogleCalendarSelectionFromNodes(nodesWithInvalidDuration);
  assert.equal(selection2.meetingDurationMinutes, 30);
});

test("Google Calendar builder translation keys exist in both English and Swedish", () => {
  assert.ok(agentBuilderEn.bookingDuration);
  assert.ok(agentBuilderEn.bookingDurationDescription);
  assert.ok(agentBuilderEn.minutesUnit);

  assert.ok(agentBuilderSv.bookingDuration);
  assert.ok(agentBuilderSv.bookingDurationDescription);
  assert.ok(agentBuilderSv.minutesUnit);
});
