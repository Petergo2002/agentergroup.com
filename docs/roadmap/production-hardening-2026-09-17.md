# Production Hardening — September 2026

**Slug:** `production-hardening-2026-09`
**Status: COMPLETE — merged 17 September 2026** (PR #7, merge commit `9bf0861`).
Retained as the implementation record. Living behaviour is documented in the
linked documents; this board is history, not a status report.

---

## 1. Overview & Objective

Close the gaps that stood between a working product and one that could be given
to paying customers: failures that vanished silently, upstream calls with no
ceiling, a security boundary asserted only by reading source text, and an
analytics range the client had to reconstruct by hand.

Constraint throughout: **many small, safe, verified changes rather than one
large rewrite.** RLS, workspace isolation, authentication, widget origin
validation, signed tokens, Stripe idempotency, rate limiting and quota
enforcement were treated as untouchable.

---

## 2. What Shipped

### Observability — failures are reported instead of lost
Sentry integration across server, edge and browser runtimes, plus
`src/lib/observability/report.ts` as the application-level API, and
`global-error.tsx` for root-layout crashes.

→ **[Observability runbook](../runbooks/observability.md)** for configuration,
the data-collection posture, and troubleshooting.

Two decisions worth not undoing:

- **`dataCollection` is set explicitly.** In Sentry v10 each category defaults
  to *collecting*, and the deprecated `sendDefaultPii: false` does not cover
  them. The defaults would have shipped widget chat request bodies — other
  companies' customers' conversations — plus cookies and `Authorization`
  headers to a third party.
- **The CSP derives Sentry's ingest origin from the DSN.** Without it the
  browser blocks every event while the SDK still reports success.

### Widget runtime — no unbounded upstream call
Connect *and* stall timeouts on OpenRouter, a tool-execution timeout, a widget
turn deadline, and a shorter stale-turn window. The stall timeout is the
important one: a stream that opens and then goes silent would otherwise pin a
serverless function until the platform killed it.

Loader bootstrap responses are reused for 5 minutes instead of refetched per
page view, and `page_hidden` / `page_unload` no longer refresh presence — an
exit event was previously keeping a session "live".

→ [Core Architecture: OpenRouter Integration](../architecture/core.md#openrouter-integration)

### Analytics — aggregation moved into Postgres
`dashboard_conversation_analytics_trend` returns per-day counts with
`generate_series`, so empty days arrive as explicit zero rows. Same posture as
the totals RPC: `security invoker`, `search_path = ''`, `execute` to
`service_role` only.

→ [Core Architecture: Analytics](../architecture/core.md#server-side-aggregation)

### Database — one duplicate index removed
`widget_sessions_widget_id_idx` was an exact duplicate of the index backing the
`(widget_id, session_id)` unique constraint. Because `last_seen_at` is indexed,
the 30-second heartbeat updates can never be HOT — measured at 5,211 updates
with only 509 HOT (~10%) — so every redundant index cost a write per heartbeat.
The remaining 14 indexes were checked against `pg_stat_user_indexes` and are
genuinely scanned.

Query plans were compared before and after: identical (`1.28..9.30`). The
migration carries its own rollback statement inline.

### Security tests — behaviour, not source text
`tests/security/widget-access-control-behaviour.test.ts` executes the real
access-control modules in a `node:vm` sandbox and asserts on outcomes, replacing
tests that only grepped source strings. Proven by mutation testing: four
deliberately broken invariants produced four failures, then were restored.

`tests/security/observability-redaction.test.ts` covers context redaction — it
caught a camelCase `privateKey` leak that the original key matcher missed.

### UI — consistency, accessibility and correctness
Global `focus-visible` and cursor defaults in the base layer, an
`--on-error-container` token for dark mode, and a redesigned analytics page.

→ [UI Patterns: interaction defaults](../guides/ui-patterns.md#interaction-defaults-you-get-for-free)

---

## 3. Verification

At merge: **402/402 tests**, 0 TypeScript errors, 0 ESLint warnings, successful
production build. Both migrations applied to production and verified — index
count 15 → 14, RLS unchanged, 491 rows intact, full widget flow exercised
afterwards.

Evidence came from measurement rather than inference: `pg_stat_statements`
deltas, `EXPLAIN` plans before and after, `curl` timings, and a deliberately
hung upstream server to prove the stall timeout fires.

---

## 4. Honest Limits

- **The authenticated application was never visually verified.** Doing so would
  have required creating users in production Supabase. Visual checks were
  limited to public routes.
- The index-drop measurement is from one production sample, not a sustained
  load test.

---

## 5. Still Open

| Item | Where |
| --- | --- |
| Leaked-password protection in Supabase Auth (no MCP/API path; dashboard only) | [Production Readiness](../runbooks/production-readiness.md) |
| `last_seen_at` remains in 8 indexes, so heartbeat updates still cannot be HOT | This board — deferred deliberately, not forgotten |
| Knowledge processing has no retry on failure | [Knowledge Processing](../guides/knowledge-processing.md) |
| ~45 hardcoded `aria-label` / `title` strings and `(admin)` route i18n | [UI & UX Refinement Board](./ui-ux-refinement-board.md) |
| No `not-found.tsx` | This board |
| `AgentBuilderClient.tsx` (~6,700 lines) resists safe change by size alone | This board |

---

*Last updated: September 17, 2026.*
