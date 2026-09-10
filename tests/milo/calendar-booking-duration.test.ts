import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMeetingDurationArguments } from "../../src/lib/google-calendar.ts";

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

test("the prompt states the enforced length instead of inviting another one", () => {
  const runtime = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");

  assert.match(runtime, /every meeting is exactly \$\{meetingDuration\} minutes long/);
  assert.doesNotMatch(runtime, /unless the visitor specifically requests another length/);
});
