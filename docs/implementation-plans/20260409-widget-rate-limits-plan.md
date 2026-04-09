# Widget Rate Limits Plan

## Goal

Add production-safe rate limiting for the public widget runtime so the platform is better protected against:

- cost spikes from abusive chat traffic
- accidental client spam or broken embed loops
- volumetric abuse against public widget endpoints
- degraded response times for legitimate customer conversations

This plan is intentionally staged. The first rollout should protect the highest-cost public surface without introducing unnecessary infra complexity or shipping a brittle blocker into customer chat.

## Problem Statement

The public widget runtime currently has strong request validation and conversation locking, but it does not have true volumetric request limiting.

Current protections already in place:

- runtime origin validation
- short-lived widget access tokens
- preview-token separation
- public payload size and shape validation
- per-session active-turn locking with `409 SESSION_BUSY`
- session completion protection during active turns

What is missing:

- per-IP request ceilings
- per-widget request ceilings
- per-session request ceilings across time windows
- `429 Too Many Requests` responses with a clear retry signal
- operator visibility into rate-limit hits and abusive clients

Turn locks prevent concurrent turns in one session. They do not stop a client from sending a large number of requests over time, rotating session ids, or spamming multiple endpoints.

## Research Summary

### Current public widget flow

The public runtime uses:

- `GET /api/public/widgets/[widgetPublicKey]/bootstrap`
- `GET /api/public/widgets/[widgetPublicKey]/config`
- `POST /api/public/widgets/[widgetPublicKey]/chat`
- `POST /api/public/widgets/[widgetPublicKey]/complete`
- `POST /api/public/widgets/[widgetPublicKey]/events`
- `POST /api/public/widgets/[widgetPublicKey]/leads`

The public chat path is the most sensitive because it:

- is customer-facing
- is billable
- writes durable chat state
- invokes the LLM runtime
- may also invoke live tools

### Current repo constraints

- There is no existing rate-limit middleware.
- There is no existing Redis, Upstash, or edge KV store in the repo.
- The current stack already relies on Supabase Postgres for widget session state, message persistence, and turn locks.
- The public widget runtime already has a load-test harness in `scripts/widget-load-test.mjs`.

### Important design implication

Because no dedicated rate-limit store exists today, the safest first implementation is an app-owned limiter backed by Supabase/Postgres. That fits the current stack, keeps operational overhead low, and can be introduced in a staged way before evaluating a migration to Redis or an edge store.

## Design Principles

1. Protect public billable endpoints first.
2. Keep preview and internal operator workflows out of the blast radius during phase 1.
3. Do not trust only `sessionId`; attackers can rotate it cheaply.
4. Avoid persisting raw IP addresses when a hashed derivative is sufficient.
5. Return explicit machine-readable `429` errors and `Retry-After`.
6. Fail predictably and log enough context for operators to understand limit hits.
7. Roll out in stages so thresholds can be tuned safely from real traffic.

## Recommended Rollout

### Phase 0: Documentation and instrumentation

- Document that rate limiting is not currently enforced on the public widget runtime.
- Add a concrete implementation plan and rollout strategy.
- Decide threshold defaults before coding.

### Phase 1: Enforce on public widget chat only

Apply real rate limiting to:

- `POST /api/public/widgets/[widgetPublicKey]/chat`

Use multiple scopes together so one weak dimension is not enough to bypass protection:

- global IP scope
- widget + IP scope
- widget + session scope

This phase is the most important because `/chat` is the cost center and the core abuse target.

### Phase 2: Expand to the rest of the public widget runtime

Apply rate limits with different thresholds to:

- `POST /api/public/widgets/[widgetPublicKey]/events`
- `POST /api/public/widgets/[widgetPublicKey]/complete`
- `POST /api/public/widgets/[widgetPublicKey]/leads`

Potentially add softer protection to:

- `GET /api/public/widgets/[widgetPublicKey]/bootstrap`
- `GET /api/public/widgets/[widgetPublicKey]/config`

These routes are lower-cost than chat, but they can still be abused.

### Phase 3: Observability and tuning

- Add operator-visible metrics for rate-limit hits by widget and endpoint.
- Review false positives and adjust thresholds.
- Re-evaluate whether traffic volume justifies moving the limiter to Redis/edge storage.

## Proposed First-Version Architecture

### Storage

Add a dedicated Postgres-backed rate-limit store in Supabase.

Recommended table shape:

- `rate_limit_windows`

Suggested columns:

- `id`
- `scope_kind`
- `scope_key`
- `endpoint`
- `window_seconds`
- `window_started_at`
- `hit_count`
- `expires_at`
- `created_at`
- `updated_at`

Recommended indexes:

- unique index on `(scope_kind, scope_key, endpoint, window_seconds, window_started_at)`
- index on `expires_at` for cleanup

### Privacy-safe keying

Do not store raw IP addresses directly in the limiter table if it can be avoided.

Instead:

- resolve a client IP from forwarded headers
- normalize it
- hash it server-side with a secret-derived salt before persistence

That gives stable rate-limit identity without turning the limiter table into a raw IP log.

### Enforcement helper

Add a shared server-side helper, for example:

- `src/lib/rate-limit.ts`

Responsibilities:

- resolve the client identity inputs
- build one or more scope keys
- increment/check current window counters transactionally
- return a structured decision:
  - `allowed`
  - `retryAfterSeconds`
  - `code`
  - `scopeKind`
  - `remaining` if available

### Endpoint integration

Phase 1 integration target:

- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`

The limiter should run after:

- widget existence lookup
- preview/runtime access validation
- payload validation

The limiter should run before:

- session creation/update writes
- turn-lock acquisition
- history load
- model execution

This ordering prevents unnecessary DB and LLM work when a request should be rejected.

## Thresholds For The First Rollout

These are intended as safe starting points, not permanent values.

### Public widget chat

Apply all three together:

- per session: `12 requests / 60 seconds`
- per widget + IP: `30 requests / 60 seconds`
- per IP global: `120 requests / 10 minutes`

Rationale:

- a real human conversation fits comfortably inside the session cap
- one abusive browser on one widget gets blocked quickly
- broad scanning across many widget sessions from the same IP still gets caught

### Public widget events

Suggested initial cap:

- `60 requests / 60 seconds` per widget + session

This allows heartbeats and visibility events without letting a broken client loop flood writes.

### Public widget complete

Suggested initial cap:

- `6 requests / 60 seconds` per session

### Public widget leads

Suggested initial cap:

- `5 requests / 10 minutes` per widget + IP

## Preview and Internal Surfaces

Phase 1 should not enforce the same hard limits on:

- widget preview token traffic
- authenticated preview chat
- internal assistants

Recommended starting behavior:

- preview-token requests either bypass the limiter or use very relaxed thresholds
- authenticated surfaces stay out of scope for the first rollout

Reason:

- the immediate abuse risk is the public widget runtime
- internal and preview surfaces already require stronger trust conditions
- shipping one well-tuned public limiter first is safer than widening scope immediately

## Error Contract

When a request is limited, return:

- HTTP `429`
- JSON payload with:
  - `error`
  - `code`
  - `retryAfterSeconds`
- `Retry-After` response header

Suggested first code values:

- `RATE_LIMITED_CHAT`
- `RATE_LIMITED_EVENTS`
- `RATE_LIMITED_COMPLETE`
- `RATE_LIMITED_LEADS`

## Client Behavior

The public widget client in `apps/widget-v2` should understand `429` responses and surface a clean user-facing message.

Recommended behavior:

- do not retry automatically
- show a short friendly message such as:
  - Swedish: `Det går lite för snabbt just nu. Vänta en stund och försök igen.`
  - English: `You're sending messages too quickly right now. Please wait a moment and try again.`
- if `retryAfterSeconds` is present, use it to improve the message or cooldown UX

## Edge Cases

### Shared IPs

Multiple legitimate users can sit behind one NAT. That is why the design should not rely only on per-IP limits. Pair IP with widget and session scopes.

### Session rotation abuse

An attacker can rotate `sessionId` values to evade session caps. That is why widget + IP and global IP scopes are both required.

### Preview traffic

Internal preview should not be accidentally throttled like public customer traffic. Preview-token traffic needs separate handling.

### Limiter race conditions

Concurrent requests must not allow undercounting. The increment/check path should be transactional or implemented in a Supabase RPC.

### Limiter cleanup

Expired windows should be easy to prune. A periodic cleanup route or scheduled SQL cleanup should be part of the plan, but not block phase 1 enforcement if `expires_at` is indexed.

### Limiter store failures

Recommended phase 1 behavior:

- fail open for non-chat endpoints with error logging
- decide explicitly whether public `/chat` should fail open or fail closed before rollout

Pragmatic first recommendation:

- fail open on unexpected limiter errors during the first rollout
- log aggressively
- revisit fail-closed only after confidence is high

This reduces the chance of blocking real customer conversations due to a new limiter bug.

## Implementation Plan

### Database

Create a new migration, likely in:

- `supabase/migrations/20260409_widget_rate_limits.sql`

Add:

- the limiter table
- indexes
- optional cleanup helper SQL
- optional RPC for atomic increment/check

### Shared server helpers

Add or update:

- `src/lib/rate-limit.ts`
- `src/lib/widgets/server.ts`

Responsibilities:

- client IP resolution
- hashed scope key generation
- shared endpoint-specific limit configuration
- structured 429 response helpers

### Public widget runtime routes

Update:

- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/events/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/complete/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts`

Phase 1 requires only `/chat`.

### Widget client

Update:

- `apps/widget-v2/src/lib/api.ts`
- `apps/widget-v2/src/Widget.tsx`

Add:

- explicit `429` handling
- user-facing cooldown messaging
- optional use of `retryAfterSeconds`

### Docs

Update:

- `docs/architecture.md`
- this implementation-plan document

## Verification Plan

### Automated

- `npm run build`
- add unit tests for scope-key generation and limiter decisions
- add route-level tests for `429` contract when thresholds are exceeded

### Manual

Verify:

1. Normal customer chat still works with no visible regression.
2. Rapid-fire chat requests hit `429` before LLM work starts.
3. Overlapping same-session turns still return `409 SESSION_BUSY` and are not replaced by rate-limit logic.
4. Preview-token flows are not accidentally blocked.
5. Widget UI shows a clean message on `429`.
6. Rate-limit headers and JSON codes match the expected contract.

### Load testing

Extend:

- `scripts/widget-load-test.mjs`

Add scenarios for:

- burst chat traffic on one session
- burst traffic with rotating session ids from one IP
- event spam without chat

## Rollout Sequence

1. Merge docs and implementation plan.
2. Implement chat-only limiter behind a conservative config.
3. Test in preview/staging with the load-test harness.
4. Roll out to production.
5. Review logs and tune thresholds.
6. Expand to events, complete, and leads after chat limits prove stable.

## File Impact Summary

Expected implementation files:

- `supabase/migrations/20260409_widget_rate_limits.sql`
- `src/lib/rate-limit.ts`
- `src/lib/widgets/server.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/events/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/complete/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts`
- `apps/widget-v2/src/lib/api.ts`
- `apps/widget-v2/src/Widget.tsx`
- `scripts/widget-load-test.mjs`
- `docs/architecture.md`

## Recommendation

Start with public widget chat only.

That gives the best protection-to-risk ratio because:

- it is your most exposed and most expensive endpoint
- it already has the strongest concept of a session turn
- it is where abuse hurts both latency and cost the most

Do not widen scope until the first phase is stable and measured.
