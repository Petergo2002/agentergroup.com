import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMeetingDurationArguments,
  isSupportedTimeZone,
} from "../../src/lib/google-calendar.ts";

test("a configured duration pins both Google Calendar duration fields", () => {
  assert.deepEqual(buildMeetingDurationArguments(30), {
    event_duration_hour: 0,
    event_duration_minutes: 30,
  });
  assert.deepEqual(buildMeetingDurationArguments(15), {
    event_duration_hour: 0,
    event_duration_minutes: 15,
  });
});

test("whole hours move out of the 0-59 minutes field", () => {
  // event_duration_minutes only accepts 0-59, so 60 must never appear there.
  assert.deepEqual(buildMeetingDurationArguments(60), {
    event_duration_hour: 1,
    event_duration_minutes: 0,
  });
  assert.deepEqual(buildMeetingDurationArguments(90), {
    event_duration_hour: 1,
    event_duration_minutes: 30,
  });
  assert.deepEqual(buildMeetingDurationArguments(120), {
    event_duration_hour: 2,
    event_duration_minutes: 0,
  });
});

test("no duration configured leaves the model's own arguments untouched", () => {
  assert.equal(buildMeetingDurationArguments(null), null);
  assert.equal(buildMeetingDurationArguments(undefined), null);
  assert.equal(buildMeetingDurationArguments(0), null);
  assert.equal(buildMeetingDurationArguments(-30), null);
  assert.equal(buildMeetingDurationArguments(Number.NaN), null);
});

test("the booking tool call is patched with the pinned duration", () => {
  const composio = readFileSync("src/lib/composio.ts", "utf8");

  // The pin has to be applied to the booking call itself, not just described in
  // the prompt, otherwise the model books whatever length it likes.
  assert.match(composio, /buildMeetingDurationArguments\(/);
  assert.match(
    composio,
    /GOOGLE_CALENDAR_CREATE_EVENT_TOOL\)[\s\S]{0,400}?withMeetingDuration\(/,
  );
  // Both the selected calendar and the duplicated primary-calendar booking.
  const createEventBlock = composio.slice(
    composio.indexOf("GOOGLE_CALENDAR_CREATE_EVENT_TOOL)"),
  );
  const patchedCalls =
    createEventBlock.slice(0, 1400).match(/withMeetingDuration\(/g) ?? [];
  assert.equal(patchedCalls.length, 2);
});

test("only genuinely resolvable timezones are trusted from tool arguments", () => {
  assert.equal(isSupportedTimeZone("Europe/Stockholm"), true);
  assert.equal(isSupportedTimeZone("UTC"), true);
  assert.equal(isSupportedTimeZone("America/New_York"), true);

  assert.equal(isSupportedTimeZone("Not/AZone"), false);
  assert.equal(isSupportedTimeZone(""), false);
  assert.equal(isSupportedTimeZone("   "), false);
  assert.equal(isSupportedTimeZone(null), false);
  assert.equal(isSupportedTimeZone(42), false);
});

test("naive datetimes are converted from the timezone the model declared", () => {
  const composio = readFileSync("src/lib/composio.ts", "utf8");

  // The model frequently sends an already-UTC-converted time with
  // timezone:"UTC". Anchoring that to the calendar zone shifted the booking by
  // the UTC offset, so an agreed 15:00 landed at 13:00.
  assert.match(composio, /const declaredTimezone = isSupportedTimeZone\(/);

  // Every naive datetime argument must use the declared zone, not the calendar
  // zone, when resolving the instant.
  const patcher = composio.slice(
    composio.indexOf("function withCalendarTimezone("),
    composio.indexOf("const patchedToolCalls"),
  );
  const declaredConversions = patcher.match(/declaredTimezone,/g) ?? [];
  assert.equal(
    declaredConversions.length,
    4,
    "start_datetime, end_datetime, time_min and time_max must all honour the declared zone",
  );

  // The calendar zone still governs how Google presents the event.
  assert.match(patcher, /nextArguments\.timezone = selectedCalendarTimezone;/);
});

test("the prompt states the enforced length instead of inviting another one", () => {
  const runtime = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");

  assert.match(runtime, /every meeting is exactly \$\{meetingDuration\} minutes long/);
  assert.doesNotMatch(runtime, /unless the visitor specifically requests another length/);
});
