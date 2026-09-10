import assert from "node:assert/strict";
import test from "node:test";
import { buildWidgetGenerativeUi } from "../../src/lib/widgets/generative-ui.ts";

test("calendar availability tool results become selectable widget slots", () => {
  assert.deepEqual(
    buildWidgetGenerativeUi({
      timezone: "Europe/Stockholm",
      durationMinutes: 45,
      toolMessages: [
        {
          name: "GOOGLECALENDAR_FIND_FREE_SLOTS",
          content: JSON.stringify({
            successful: true,
            data: {
              response_data: {
                available_slots: [
                  { start: "2026-09-11T10:00:00+02:00" },
                  "2026-09-11T13:00:00+02:00",
                ],
              },
            },
          }),
        },
      ],
    }),
    {
      type: "calendar_availability",
      timezone: "Europe/Stockholm",
      durationMinutes: 45,
      slots: [
        {
          start: "2026-09-11T08:00:00.000Z",
          end: "2026-09-11T08:45:00.000Z",
        },
        {
          start: "2026-09-11T11:00:00.000Z",
          end: "2026-09-11T11:45:00.000Z",
        },
      ],
    },
  );
});

test("calendar availability cards expand free windows and never expose busy windows", () => {
  const ui = buildWidgetGenerativeUi({
    timezone: "Europe/Stockholm",
    durationMinutes: 30,
    toolMessages: [
      {
        name: "GOOGLECALENDAR_FIND_FREE_SLOTS",
        content: JSON.stringify({
          successful: true,
          data: {
            calendars: {
              primary: {
                busy: [
                  {
                    start: "2026-09-11T11:30:00+02:00",
                    end: "2026-09-11T12:30:00+02:00",
                  },
                ],
                free: [
                  {
                    start: "2026-09-11T09:00:00+02:00",
                    end: "2026-09-11T11:00:00+02:00",
                  },
                ],
              },
            },
          },
        }),
      },
    ],
  });

  assert.equal(ui?.type, "calendar_availability");
  if (ui?.type !== "calendar_availability") return;
  assert.deepEqual(
    ui.slots.map((slot) => slot.start),
    [
      "2026-09-11T07:00:00.000Z",
      "2026-09-11T07:30:00.000Z",
      "2026-09-11T08:00:00.000Z",
      "2026-09-11T08:30:00.000Z",
    ],
  );
  assert.equal(
    ui.slots.some((slot) => slot.start === "2026-09-11T09:30:00.000Z"),
    false,
  );
});

test("successful calendar creation becomes a confirmation card with safe links", () => {
  assert.deepEqual(
    buildWidgetGenerativeUi({
      timezone: "Europe/Stockholm",
      toolMessages: [
        {
          name: "GOOGLECALENDAR_CREATE_EVENT",
          content: JSON.stringify({
            successful: true,
            data: {
              response_data: {
                summary: "Intro call",
                start: { dateTime: "2026-09-11T10:00:00+02:00" },
                end: { dateTime: "2026-09-11T10:30:00+02:00" },
                htmlLink: "https://calendar.google.com/event?id=safe",
                hangoutLink: "https://meet.google.com/abc-defg-hij",
              },
            },
          }),
        },
      ],
    }),
    {
      type: "calendar_booking_confirmation",
      timezone: "Europe/Stockholm",
      title: "Intro call",
      start: "2026-09-11T08:00:00.000Z",
      end: "2026-09-11T08:30:00.000Z",
      calendarUrl: "https://calendar.google.com/event?id=safe",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
    },
  );
});
