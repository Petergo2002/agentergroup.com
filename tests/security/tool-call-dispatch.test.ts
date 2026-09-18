import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchToolCalls,
  getExecutableToolCalls,
  type ExecutableToolCall,
} from "../../src/lib/composio-dispatch.ts";

function toolCall(id: string, name: string): ExecutableToolCall {
  return {
    id,
    type: "function",
    function: { name, arguments: "{}" },
  } as ExecutableToolCall;
}

function recordingProvider(failFor: Record<string, Error> = {}) {
  const executed: string[] = [];

  return {
    executed,
    provider: {
      async executeToolCall(_userId: string, call: ExecutableToolCall) {
        const failure = failFor[call.id];
        if (failure) {
          throw failure;
        }
        executed.push(call.id);
        return JSON.stringify({ successful: true, id: call.id });
      },
    },
  };
}

const neverRecreate = async () => false;

test("every requested tool call runs, not just the first", async () => {
  const { executed, provider } = recordingProvider();

  const { results, hadToolFailure } = await dispatchToolCalls({
    provider,
    userId: "user_1",
    toolCalls: [
      toolCall("call_a", "GOOGLECALENDAR_CREATE_EVENT"),
      toolCall("call_b", "GMAIL_SEND_EMAIL"),
      toolCall("call_c", "GOOGLECALENDAR_FIND_FREE_SLOTS"),
    ],
    recreateSession: neverRecreate,
  });

  // The provider SDK's own handleToolCalls would have run only `call_a`.
  assert.deepEqual(executed, ["call_a", "call_b", "call_c"]);
  assert.equal(hadToolFailure, false);
  assert.deepEqual(
    results.map((message) => message.tool_call_id),
    ["call_a", "call_b", "call_c"],
  );
});

test("a booking mirrored onto the primary calendar executes both writes", async () => {
  const { executed, provider } = recordingProvider();

  const { results } = await dispatchToolCalls({
    provider,
    userId: "user_1",
    toolCalls: [
      toolCall("call_a", "GOOGLECALENDAR_CREATE_EVENT"),
      toolCall("call_a_primary", "GOOGLECALENDAR_CREATE_EVENT"),
    ],
    recreateSession: neverRecreate,
  });

  assert.deepEqual(executed, ["call_a", "call_a_primary"]);
  assert.equal(results.length, 2);
});

test("one failing call does not prevent the others, and is reported", async () => {
  const { executed, provider } = recordingProvider({
    call_b: new Error("Calendar rejected the event"),
  });

  const { results, hadToolFailure } = await dispatchToolCalls({
    provider,
    userId: "user_1",
    toolCalls: [
      toolCall("call_a", "GOOGLECALENDAR_CREATE_EVENT"),
      toolCall("call_b", "GMAIL_SEND_EMAIL"),
      toolCall("call_c", "GOOGLECALENDAR_FIND_FREE_SLOTS"),
    ],
    recreateSession: neverRecreate,
  });

  assert.deepEqual(executed, ["call_a", "call_c"]);
  assert.equal(hadToolFailure, true);

  // Every original call still gets exactly one result, so the transcript we
  // hand back to the model stays valid.
  assert.deepEqual(
    results.map((message) => message.tool_call_id),
    ["call_a", "call_b", "call_c"],
  );
  assert.match(String(results[1].content), /Calendar rejected the event/);
});

test("a session error retries only the failing call, never a completed one", async () => {
  const executed: string[] = [];
  let attemptsForB = 0;
  let recreations = 0;

  const provider = {
    async executeToolCall(_userId: string, call: ExecutableToolCall) {
      if (call.id === "call_b") {
        attemptsForB += 1;
        if (attemptsForB === 1) {
          throw new Error("Tool router session not found");
        }
      }
      executed.push(call.id);
      return JSON.stringify({ successful: true });
    },
  };

  const { results, sessionWasRecreated, hadToolFailure } =
    await dispatchToolCalls({
      provider,
      userId: "user_1",
      toolCalls: [
        toolCall("call_a", "GOOGLECALENDAR_CREATE_EVENT"),
        toolCall("call_b", "GMAIL_SEND_EMAIL"),
      ],
      recreateSession: async () => {
        recreations += 1;
        return true;
      },
    });

  assert.equal(sessionWasRecreated, true);
  assert.equal(recreations, 1);
  assert.equal(hadToolFailure, false);

  // `call_a` already succeeded — replaying the whole batch would have booked
  // the same appointment twice.
  assert.deepEqual(executed, ["call_a", "call_b"]);
  assert.equal(results.length, 2);
});

test("tool calls are collected from every choice in the completion", () => {
  const collected = getExecutableToolCalls({
    choices: [
      {
        message: {
          tool_calls: [
            toolCall("call_a", "GOOGLECALENDAR_CREATE_EVENT"),
            toolCall("call_b", "GMAIL_SEND_EMAIL"),
          ],
        },
      },
      { message: { tool_calls: [toolCall("call_c", "CAL_CREATE_BOOKING")] } },
      { message: { content: "no tools here" } },
    ],
  } as never);

  assert.deepEqual(
    collected.map((call) => call.id),
    ["call_a", "call_b", "call_c"],
  );
});
