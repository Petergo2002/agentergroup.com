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

The orchestration deadline is 110 seconds. On timeout or a handled error it saves
a failure message and releases its lease; Retry resumes saved embedding progress.
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
