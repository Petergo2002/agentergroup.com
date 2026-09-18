# Knowledge processing

Website imports run through `process-knowledge-source`. It authorizes source access,
claims a database lease, scrapes the selected pages, saves the extracted text, and
checkpoints embeddings before publishing the source as `ready`.

## CPU isolation and retries

`embed-knowledge-chunk` performs one `gte-small` inference per request. Only service
keys can invoke it. Input is bounded to 1,400 characters and 10KB of JSON; vectors
must contain 384 finite numbers. The orchestrator sends at most two requests at a
time and retries transient failures at most three times with backoff and jitter.
Permanent HTTP errors are not retried. The model remains compatible with the
existing `search-knowledge` function and vector columns.

### Rate limits are transient, and must be treated as such

One inference per request means a 62-chunk page makes 62 nested function calls,
and the edge runtime limits those per trace. It signals this by throwing a
`RateLimitError` carrying `retryAfterMs`.

That error is not a `ProcessingError`, not a `TypeError`, and its name is not in
the abort list, so the original retry predicate classified **the one error that
states its own Retry-After** as permanent and gave up on the first occurrence.
This is what made scraping look unreliable: on 18 September 2026 a 62-chunk
source embedded 30 chunks, hit the limit, and was marked `failed` — with the
work it had already done still saved but invisible.

Three things keep it working now:

- `isTransientFailure()` recognises rate limits, and `retryTransient` waits for
  the delay the platform asked for rather than a 0.5s backoff against a
  47-second limit.
- Retries never sleep past the run's deadline. Waiting out a long limit inside
  what remains of 110 seconds is often impossible, and stopping lets the next
  run resume from the checkpoint instead of burning this one.
- A 250ms gap between embedding batches keeps the burst under the limiter in the
  first place.

**If this resurfaces, the next lever is call volume, not backoff.** Batching
several chunks per worker request would cut 62 calls to a handful, but it
trades against the deliberate one-inference-per-request CPU isolation above —
which exists because the worker has its own CPU ceiling (`EMBEDDING_WORKER_LIMIT`,
HTTP 546). Change it knowing that trade.

Firecrawl is pinned to 4.32.0 in the Edge Function, uses explicit request timeouts,
bounded retries and TLS verification. A selected page that fails or returns an
HTTP error is reported; a partially scraped selection is not marked successful.
Completed crawl jobs are required before their results are used.

## Progress and concurrency

The service-only `claim_knowledge_processing` RPC grants a three-minute lease.
Concurrent requests return `202` without starting another job. Every checkpoint
locks the source row and verifies the lease token. A worker whose lease expired
cannot publish after another worker takes over.

Checkpoints use a SHA-256 revision of the normalized text and chunking/model
version. Retrying unchanged content skips saved embeddings. Edited content gets a
new revision. Finalization verifies that every expected chunk exists, removes
obsolete chunks and marks the source ready in one transaction. Knowledge search
already excludes sources that are not ready.

The orchestration deadline is 110 seconds.

**A recoverable stop is not a failure.** On a rate limit, a timeout, or any
transient error, the source returns to `pending` with an explanatory message and
the function answers `202` with `resume: true`. `queueKnowledgeProcessing` then
re-invokes it — up to three times per request, waiting the stated delay capped at
15 seconds — and each run continues from the last checkpoint. `failed` is
reserved for what will not heal on its own: a missing Firecrawl key, an exceeded
storage limit, unreadable pages.

Only a website crawl that times out *before* its text is saved really starts
over, because `raw_text` is written once the whole selection is scraped. The
timeout message says so rather than promising progress that was never written.
If the platform terminates the worker before its error handler runs, the source
list marks expired leases as interrupted. Retry can also reclaim an expired lease
directly. Recovery does not run on a schedule: it occurs when the source list is
loaded or processing is retried. Failed page selections are scraped again on retry;
only a fully scraped selection is saved as source text.

## Validation and deployment

- `node --experimental-strip-types --test tests/security/knowledge*.test.ts`
- Run `tests/sql/knowledge-processing.sql` inside `BEGIN` / `ROLLBACK` against a
  database with an existing knowledge source. It checks duplicate claims, expired
  leases, stale workers, idempotent checkpoints, incomplete publication and grants.
- Apply `20260907142437_resumable_knowledge_processing.sql`, then deploy
  `embed-knowledge-chunk`, then `process-knowledge-source`, then the Next.js routes.
  Both Edge Functions use handler-level authentication with `verify_jwt = false`.

The original failed avenro.se source was recovered with 16 embeddings. Live checks
also covered duplicate requests, a fresh three-page scrape and resuming a source
with two saved embeddings. Temporary verification sources were deleted afterward.

**18 September 2026.** A four-page lackageexperten.se source failed at 30 of 62
chunks with `RateLimitError ... Retry after 47249ms`, surfacing in Vercel as
`KNOWLEDGE_PROCESSING_FAILED` / 503. After the retry fix was deployed, re-running
the same source resumed from its 30 saved embeddings and finished all 62. The
diagnosis came from `function_logs`, which carries the real error — the source
row only ever held the generic fallback message.
