import assert from "node:assert/strict";
import test from "node:test";
import {
  generateRemoteEmbedding,
  generateRemoteEmbeddings,
  embedWithWorkerLimitFallback,
  MAX_EMBEDDING_BATCH,
  isRateLimitError,
  isTransientFailure,
  ProcessingError,
  readRateLimitRetryMs,
  shouldRetrySameRequest,
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
      // The singular helper now rides the batch path, so the worker answers
      // with `embeddings`.
      return new Response(JSON.stringify({ embeddings: [embedding] }), {
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

test("a batch embeds every chunk in one round trip, in order", async () => {
  // One call per chunk made a 60-chunk page take 111 seconds and trip the
  // per-trace limiter. Eight per call turns those 60 calls into 8.
  let calls = 0;
  let sent: string[] = [];

  const embeddings = await generateRemoteEmbeddings(["alpha", "beta", "gamma"], {
    url: "https://example.supabase.co",
    key: "test-key",
    fetcher: (async (_url: string, init: RequestInit) => {
      calls += 1;
      sent = JSON.parse(String(init.body)).contents;
      return new Response(
        JSON.stringify({
          embeddings: sent.map((_, index) =>
            Array.from({ length: 384 }, () => index + 1),
          ),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch,
  });

  assert.equal(calls, 1);
  assert.deepEqual(sent, ["alpha", "beta", "gamma"]);
  assert.equal(embeddings.length, 3);
  assert.equal(embeddings[0][0], 1);
  assert.equal(embeddings[2][0], 3);
});

test("the batch size stays under the worker's measured CPU ceiling", () => {
  // Measured against the live worker: 1-4 returned 200, 6 and 8 returned HTTP
  // 546. It must also stay within the checkpoint RPC's cap of 8 per call.
  assert.ok(MAX_EMBEDDING_BATCH >= 1 && MAX_EMBEDDING_BATCH <= 4);
});

test("an oversized batch is rejected before any network call", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      generateRemoteEmbeddings(Array.from({ length: 9 }, () => "text"), {
        url: "https://example.supabase.co",
        key: "test-key",
        fetcher: (async () => {
          calls += 1;
          return new Response("{}", { status: 200 });
        }) as unknown as typeof fetch,
      }),
    /Invalid embedding batch size/,
  );
  assert.equal(calls, 0);
});

test("a short or mismatched batch response is rejected", async () => {
  // Silently accepting fewer vectors than chunks would attach the wrong
  // embedding to a chunk and quietly corrupt retrieval.
  await assert.rejects(
    () =>
      generateRemoteEmbeddings(["one", "two"], {
        url: "https://example.supabase.co",
        key: "test-key",
        fetcher: (async () =>
          new Response(
            JSON.stringify({
              embeddings: [Array.from({ length: 384 }, () => 1)],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )) as unknown as typeof fetch,
      }),
    /invalid vector/,
  );
});

test("a worker CPU limit splits the batch instead of failing the source", async () => {
  // Chunk cost varies with content, so no fixed batch is safe for every page.
  // Hitting HTTP 546 should degrade, not stop.
  const sizes: number[] = [];

  const embeddings = await embedWithWorkerLimitFallback(
    ["a", "b", "c", "d"],
    {
      url: "https://example.supabase.co",
      key: "test-key",
      fetcher: (async (_url: string, init: RequestInit) => {
        const { contents } = JSON.parse(String(init.body)) as { contents: string[] };
        sizes.push(contents.length);
        if (contents.length > 2) {
          return new Response("worker limit", { status: 546 });
        }
        return new Response(
          JSON.stringify({
            embeddings: contents.map(() => Array.from({ length: 384 }, () => 0.5)),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    },
  );

  assert.equal(embeddings.length, 4);
  // Tried 4, was refused, then split into two halves that succeeded.
  assert.deepEqual(sizes, [4, 2, 2]);
});

test("a single chunk the worker refuses is still a real failure", async () => {
  // There is nothing left to split, so this must surface rather than loop.
  await assert.rejects(
    () =>
      embedWithWorkerLimitFallback(["only"], {
        url: "https://example.supabase.co",
        key: "test-key",
        fetcher: (async () =>
          new Response("worker limit", { status: 546 })) as unknown as typeof fetch,
      }),
    /HTTP 546/,
  );
});

test("a worker CPU limit is recoverable but never retried identically", () => {
  // Both matter: retrying the same batch wastes the budget, but the source
  // must still resume rather than being marked failed.
  const workerLimit = new ProcessingError(
    "Embedding service returned HTTP 546.",
    "EMBEDDING_WORKER_LIMIT",
    546,
  );

  assert.equal(shouldRetrySameRequest(workerLimit), false);
  assert.equal(isTransientFailure(workerLimit), true);

  // Ordinary upstream failures are still worth one more attempt.
  const upstream = new ProcessingError("busy", "EMBEDDING_SERVICE_ERROR", 503);
  assert.equal(shouldRetrySameRequest(upstream), true);
});
