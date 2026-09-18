# Knowledge processing

Website imports run through `process-knowledge-source`. It authorizes source access,
claims a database lease, scrapes the selected pages, saves the extracted text, and
checkpoints embeddings before publishing the source as `ready`.

## CPU isolation and retries

`embed-knowledge-chunk` runs `gte-small` over a small batch per request — at most
`MAX_EMBEDDING_BATCH` (4) chunks, embedded one after another so a batch costs the
same CPU as those chunks did individually, minus the per-request overhead. Only
service keys can invoke it. Input is bounded to 1,400 characters per chunk;
vectors must contain 384 finite numbers, and a response whose vector count does
not match the request is rejected rather than risking a chunk being paired with
the wrong embedding. The single-item `{ content }` form still works so the two
functions can be deployed moments apart.

**Four is measured, not chosen.** Against the live worker: batches of 1-4
returned 200 (four chunks in ~2.0s) while 6 and 8 returned **HTTP 546**, the
worker's own CPU ceiling. That ceiling is why the original design used one
inference per request. Because chunk cost varies with content, no fixed size is
safe for every page, so `embedWithWorkerLimitFallback` halves a batch that is
refused and retries — worst case degrading to one chunk per call, which is
exactly the old behaviour and so can never be slower.

A worker limit is recoverable but is never retried identically: the same chunks
cost the same CPU next time, and spending three attempts on it only burns the
budget before the batch can be split. `shouldRetrySameRequest()` encodes that,
separately from `isTransientFailure()` which decides whether the source resumes.
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

Call volume was the underlying cause, and batching addressed it: a 63-chunk
source now makes ~16 worker calls instead of 63. The remaining levers, if this
ever resurfaces, are the crawl itself and the 110-second budget — not backoff.

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

**Something must still drive a source whose request has ended.** Otherwise a
paused source sits at "Pending" forever, which is a worse failure than the one it
replaced: it looks hung rather than actionable. `GET /api/knowledge/sources`
therefore re-queues pending sources that hold no lease and have not been touched
for 30 seconds, capped at five per load — alongside the older sweep that marks
leases abandoned mid-run as interrupted. Opening the Knowledge page is the
recovery point the pipeline already relied on; it now resumes as well as relabels.
A source younger than the grace window still has its original run in flight, and
even if that races, `claim_knowledge_processing` refuses the second worker.

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

A second run of the same four pages then took **111 seconds and still did not
finish**: every chunk embedded, but the deadline arrived before finalization and
the source sat at `pending`. That produced the batching work and the resume path
below. Measured on the same four pages afterwards, from a cleared source:
**40 seconds, 63 chunks, `ready`.** The temporary verification source was
deleted.

## The status a customer actually sees

Ingestion takes tens of seconds, so the Knowledge list refreshes itself rather
than waiting to be reloaded. `KNOWLEDGE_POLL_INTERVAL_MS` is 3 seconds and the
timer only runs while a source is `pending` or `processing` — a settled list
polls nothing, and a hidden tab skips its ticks and catches up on
`visibilitychange`.

Three things the list gets right, each of which was wrong before:

- **`pending` reads as working.** It renders with the same spinner and accent as
  `processing`. Neutral grey read as idle, which is the opposite of what pending
  means now that a paused source resumes on its own.
- **The Syncing tile counts `pending` as well as `processing`.** Counting only
  the latter left a paused source inside Total but in none of Ready, Syncing or
  Failed, so the summary said "Syncing 0" next to a visibly pending row.
- **Progress is shown while it moves.** `metadata.processingProgress` is written
  by every checkpoint, so "42/63" advances as the polls come in. It disappears
  once complete, so a finished source never shows a stale count.
