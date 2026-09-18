import assert from "node:assert/strict";
import test from "node:test";
import {
  generateRemoteEmbedding,
  isRateLimitError,
  isTransientFailure,
  ProcessingError,
  readRateLimitRetryMs,
  retryTransient,
} from "../../supabase/functions/_shared/processing.ts";

/** The shape the edge runtime actually threw when ingestion failed. */
function rateLimitError(retryAfterMs = 47_249) {
  const error = new Error(
    `Rate limit exceeded for trace 01a0b4df. Retry after ${retryAfterMs}ms.`,
  );
  error.name = "RateLimitError";
  (error as Error & { retryAfterMs: number }).retryAfterMs = retryAfterMs;
  return error;
}

test("a rate limit is recognised as retryable", () => {
  // The regression: RateLimitError is not a ProcessingError, not a TypeError,
  // and its name is not Timeout/Abort — so the old predicate called the one
  // error carrying its own Retry-After permanent, and ingestion gave up.
  const error = rateLimitError();

  assert.equal(isRateLimitError(error), true);
  assert.equal(isTransientFailure(error), true);
  assert.equal(readRateLimitRetryMs(error), 47_249);
});

test("rate limits are detected by name or status when no delay is given", () => {
  const byName = new Error("slow down");
  byName.name = "RateLimitError";
  assert.equal(readRateLimitRetryMs(byName), 0);

  assert.equal(readRateLimitRetryMs({ status: 429 }), 0);
  assert.equal(readRateLimitRetryMs(new Error("nope")), null);
  assert.equal(readRateLimitRetryMs(null), null);
  assert.equal(isRateLimitError(new Error("nope")), false);
});

test("a permanent failure is still not retried", () => {
  assert.equal(
    isTransientFailure(new ProcessingError("bad input", "INVALID", 400)),
    false,
  );
  assert.equal(
    isTransientFailure(new ProcessingError("upstream", "ERR", 503)),
    true,
  );
});

test("retryTransient waits out a rate limit and then succeeds", async () => {
  const waits: number[] = [];
  let calls = 0;

  const result = await retryTransient(
    async () => {
      calls += 1;
      if (calls === 1) throw rateLimitError(47_249);
      return "embedded";
    },
    {
      sleep: async (ms) => {
        waits.push(ms);
      },
    },
  );

  assert.equal(result, "embedded");
  assert.equal(calls, 2);
  // It must honour the platform's own delay, not a 0.5s backoff against a
  // 47-second limit.
  assert.deepEqual(waits, [47_249]);
});

test("a rate limit with no stated delay still gets normal backoff", async () => {
  const waits: number[] = [];
  let calls = 0;

  await retryTransient(
    async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("too fast");
        error.name = "RateLimitError";
        throw error;
      }
      return true;
    },
    { sleep: async (ms) => void waits.push(ms) },
  );

  assert.equal(calls, 2);
  assert.ok(waits[0] >= 500 && waits[0] < 1_000, `unexpected backoff ${waits[0]}`);
});

test("it never sleeps past the run's deadline", async () => {
  // Waiting out a 47s limit inside what remains of a 110s budget is often
  // impossible. Stopping lets the next run continue from the checkpoint
  // instead of burning the rest of this one.
  const controller = new AbortController();
  let calls = 0;

  await assert.rejects(
    () =>
      retryTransient(
        async () => {
          calls += 1;
          throw rateLimitError(47_249);
        },
        {
          signal: controller.signal,
          sleep: () =>
            new Promise<void>(() => {
              // Never resolves; only the abort ends the wait.
              controller.abort(new Error("deadline"));
            }),
        },
      ),
    /Rate limit exceeded/,
  );

  assert.equal(calls, 1);
});

test("an already-expired deadline stops retrying immediately", async () => {
  const controller = new AbortController();
  controller.abort(new Error("deadline"));
  let calls = 0;

  await assert.rejects(
    () =>
      retryTransient(
        async () => {
          calls += 1;
          throw rateLimitError();
        },
        { signal: controller.signal, sleep: async () => {} },
      ),
    /Rate limit exceeded/,
  );

  assert.equal(calls, 1);
});

test("a transient embedding failure recovers instead of failing the source", async () => {
  let calls = 0;
  const embedding = Array.from({ length: 384 }, (_, index) => (index % 7) + 1);

  const result = await generateRemoteEmbedding("some chunk text", {
    url: "https://example.supabase.co",
    key: "test-key",
    fetcher: (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("upstream busy", { status: 503 });
      }
      return new Response(JSON.stringify({ embedding }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch,
  });

  assert.equal(calls, 2);
  assert.equal(result.length, 384);
});

test("an invalid chunk is rejected before any network call", async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      generateRemoteEmbedding("x".repeat(5_000), {
        url: "https://example.supabase.co",
        key: "test-key",
        fetcher: (async () => {
          calls += 1;
          return new Response("{}", { status: 200 });
        }) as unknown as typeof fetch,
      }),
    /Invalid embedding input size/,
  );

  assert.equal(calls, 0);
});
