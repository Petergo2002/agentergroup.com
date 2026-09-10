import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getWidgetStreamCompletionError,
  MAX_STATUS_LENGTH,
  parseWidgetStreamEvent,
} from "../../apps/widget-v2/src/lib/streaming.ts";

test("widget stream parser preserves deltas and terminal error codes", () => {
  assert.deepEqual(parseWidgetStreamEvent('{"delta":"Hello"}'), {
    type: "delta",
    content: "Hello",
  });
  assert.deepEqual(
    parseWidgetStreamEvent(
      '{"error":"Generation failed","code":"INTERNAL_ERROR"}',
    ),
    {
      type: "error",
      message: "Generation failed",
      code: "INTERNAL_ERROR",
    },
  );
  assert.deepEqual(parseWidgetStreamEvent("[DONE]"), { type: "done" });
  assert.deepEqual(
    parseWidgetStreamEvent(
      '{"ui":{"type":"calendar_availability","timezone":"Europe/Stockholm","durationMinutes":30,"slots":[{"start":"2026-09-11T08:00:00.000Z","end":"2026-09-11T08:30:00.000Z"}]}}',
    ),
    {
      type: "ui",
      ui: {
        type: "calendar_availability",
        timezone: "Europe/Stockholm",
        durationMinutes: 30,
        slots: [
          {
            start: "2026-09-11T08:00:00.000Z",
            end: "2026-09-11T08:30:00.000Z",
          },
        ],
      },
    },
  );
});

test("widget stream parser rejects malformed protocol data", () => {
  assert.throws(
    () => parseWidgetStreamEvent("not-json"),
    /reply stream contained invalid data/i,
  );
  assert.deepEqual(
    parseWidgetStreamEvent(
      '{"ui":{"type":"calendar_availability","timezone":"UTC"}}',
    ),
    { type: "noop" },
  );
});

test("widget stream parser accepts progress phases and bounds their length", () => {
  assert.deepEqual(parseWidgetStreamEvent('{"status":"knowledge"}'), {
    type: "status",
    status: "knowledge",
  });
  assert.deepEqual(parseWidgetStreamEvent('{"status":"tools"}'), {
    type: "status",
    status: "tools",
  });

  // Blank or non-string phases must not produce a status event.
  assert.deepEqual(parseWidgetStreamEvent('{"status":"   "}'), { type: "noop" });
  assert.deepEqual(parseWidgetStreamEvent('{"status":42}'), { type: "noop" });

  const overlong = parseWidgetStreamEvent(
    JSON.stringify({ status: "x".repeat(500) }),
  );
  assert.equal(overlong.type, "status");
  if (overlong.type !== "status") return;
  assert.equal(overlong.status.length, MAX_STATUS_LENGTH);
});

test("widget rejects truncated and empty completed streams", () => {
  assert.match(
    getWidgetStreamCompletionError({
      receivedDoneEvent: false,
      content: "partial",
    }) ?? "",
    /ended before the reply finished/i,
  );
  assert.match(
    getWidgetStreamCompletionError({
      receivedDoneEvent: true,
      content: "   ",
    }) ?? "",
    /empty reply/i,
  );
  assert.equal(
    getWidgetStreamCompletionError({
      receivedDoneEvent: true,
      content: "Complete answer",
    }),
    null,
  );
});

test("agent recovery and fallback content are forwarded to stream consumers", () => {
  const source = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");
  const recoveryIndex = source.indexOf("recoveryContent += delta.content");
  const recoveryTokenIndex = source.indexOf(
    "if (onToken) onToken(delta.content)",
    recoveryIndex,
  );
  const trimmedFallbackIndex = source.indexOf("if (!assistantContent.trim())");
  const fallbackTokenIndex = source.indexOf(
    "if (onToken) onToken(assistantContent)",
    trimmedFallbackIndex,
  );

  assert.ok(recoveryIndex >= 0);
  assert.ok(recoveryTokenIndex > recoveryIndex);
  assert.ok(trimmedFallbackIndex > recoveryTokenIndex);
  assert.ok(fallbackTokenIndex > trimmedFallbackIndex);
});
