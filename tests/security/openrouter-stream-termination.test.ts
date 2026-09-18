import assert from "node:assert/strict";
import test from "node:test";
import { streamOpenRouterResponse } from "../../src/lib/openrouter.ts";

/** A Response whose body emits the given SSE lines and then ends. */
function sseResponse(lines: string[]) {
  const encoder = new TextEncoder();

  return {
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            if (index >= lines.length) {
              return { done: true, value: undefined };
            }
            const chunk = encoder.encode(`${lines[index]}\n`);
            index += 1;
            return { done: false, value: chunk };
          },
          releaseLock() {},
        };
      },
    },
  } as unknown as Response;
}

async function collect(response: Response) {
  const chunks: unknown[] = [];
  for await (const chunk of streamOpenRouterResponse(response)) {
    chunks.push(chunk);
  }
  return chunks;
}

const contentDelta = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

test("a stream that just ends is reported as incomplete, not as an answer", async () => {
  // The upstream socket drops after one delta: no [DONE], no finish reason.
  // Accepting this is how "Your appointment is" gets saved as a finished reply.
  await assert.rejects(
    () => collect(sseResponse([contentDelta("Your appointment is")])),
    /before it was complete/i,
  );
});

test("an empty stream that never says anything is incomplete too", async () => {
  await assert.rejects(() => collect(sseResponse([])), /before it was complete/i);
});

test("a stream terminated by [DONE] succeeds", async () => {
  const chunks = await collect(
    sseResponse([contentDelta("Booked for Tuesday."), "data: [DONE]"]),
  );

  assert.equal(chunks.length, 1);
});

test("a stream terminated by a finish reason succeeds without [DONE]", async () => {
  const chunks = await collect(
    sseResponse([
      contentDelta("Booked for Tuesday."),
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}`,
    ]),
  );

  assert.equal(chunks.length, 2);
});

test("an explicit provider error still throws that error", async () => {
  await assert.rejects(
    () =>
      collect(
        sseResponse([
          contentDelta("partial"),
          `data: ${JSON.stringify({ error: { message: "Upstream model overloaded" } })}`,
        ]),
      ),
    /Upstream model overloaded/,
  );
});

test("a finish_reason of error is not mistaken for a clean ending", async () => {
  await assert.rejects(
    () =>
      collect(
        sseResponse([
          contentDelta("partial"),
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "error" }] })}`,
        ]),
      ),
    /ended the response with an error/i,
  );
});

test("a truncated tool-call payload does not pass as a complete turn", async () => {
  // Tool arguments arrive in fragments; a cut mid-JSON leaves the call
  // unusable, so the turn must fail rather than dispatch half an action.
  await assert.rejects(
    () =>
      collect(
        sseResponse([
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_a",
                      function: {
                        name: "GOOGLECALENDAR_CREATE_EVENT",
                        arguments: '{"start":"2026-',
                      },
                    },
                  ],
                },
              },
            ],
          })}`,
        ]),
      ),
    /before it was complete/i,
  );
});
