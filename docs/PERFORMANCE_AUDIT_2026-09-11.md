# Performance Audit — 2026-09-11: function/database region mismatch

Date: 2026-09-11
Application: Next.js 16.3.4 / React 19.2.8 / Supabase / Vercel
Supersedes nothing; complements [PERFORMANCE_AUDIT_REPORT.md](./PERFORMANCE_AUDIT_REPORT.md) (2026-08-05).

## Executive summary

Authenticated sidebar navigation felt slow. The August 5 audit had already removed the duplicate bootstrap work, lazy-loaded the builder, and tenant-qualified the SWR caches — yet navigation was still slow, which suggested the remaining cost was somewhere that audit had not looked.

It was. **Vercel functions execute in `iad1` (US East) while the Supabase project is in `eu-west-1` (Ireland).** Every server-side Supabase call is a transatlantic round trip.

The database is not slow. Every query on the navigation path executes in **0.36–2.0 ms**. A single `/widgets` navigation makes **nine sequential round trips**, so roughly **10 ms of database work is wrapped in 700–800 ms of network latency**.

This is a deployment configuration issue, not an application architecture issue. It was invisible to previous audits because every code-level metric looks healthy: the indexes are right, the queries are fast, the caches are correct.

## Evidence

| Measurement | Method | Result |
| --- | --- | --- |
| Function region | `curl -D- https://avenro.se/login` → `x-vercel-id` | `arn1::iad1` — entered Stockholm, **executed in `iad1`**. Consistent across 7 requests. |
| Database region | Supabase project metadata | `eu-west-1` (Ireland) |
| Query cost | `pg_stat_statements`, 181-day window | `profiles` 0.99 ms · `workspace_members`+join 1.71 ms · `workspace_subscriptions` 1.43 ms · `widgets` 1.52 ms · `agents` 1.56 ms |
| Round-trip cost | `curl` to PostgREST, warm connection | ~63 ms TTFB for a ~1 ms query (from Sweden; `iad1`→`eu-west-1` is ~80–100 ms) |
| Data volume | `count(*)` | 4 profiles, 4 workspaces, 6 agents, 461 widget_sessions |
| Index health | Supabase performance advisors | No missing indexes on hot paths. 38 unused indexes, 16 unindexed FKs — all INFO. |
| Static assets | `curl` a `/_next/static` chunk | `public,max-age=31536000,immutable`, CDN `HIT` — correct |

### Per-navigation waterfall (`/widgets`, all sequential)

| # | Where | Call | DB | Network |
| --- | --- | --- | --- | --- |
| 1 | `src/lib/supabase/proxy.ts:144` | `auth.getClaims()` (proxy) | — | local ES256 verify |
| 2 | `src/lib/app/request-context.ts:14` | `auth.getUser()` | — | ~90 ms |
| 3 | `src/lib/app/profile-sync.ts:73` | `SELECT profiles` | 0.99 ms | ~90 ms |
| 4 | `src/lib/app/bootstrap.ts:268` | `SELECT workspace_members` + join | 1.71 ms | ~90 ms |
| 5 | `src/lib/app/bootstrap.ts:393` | `SELECT workspace_subscriptions` | 1.43 ms | ~90 ms |
| 6 | `src/lib/widgets/loader.ts:170` | `SELECT widgets` | 1.52 ms | ~90 ms |
| 7 | `src/lib/widgets/loader.ts:18` | `SELECT workspace_subscriptions` (**duplicate of #5**) | 1.43 ms | ~90 ms |
| 8 | `src/lib/widgets/loader.ts:193` | `SELECT widget_agents` | ~1 ms | ~90 ms |
| 9 | `src/lib/widgets/loader.ts:219` | `SELECT agents` | 1.56 ms | ~90 ms |

Steps 1–5 are identical on every `(app)` route. `AppShell`'s badge poll independently repeats steps 1–5 on every page load and then every 60 s.

## Implemented (config only)

### 1. Co-locate functions with the database — `vercel.json`

```json
{ "regions": ["arn1"] }
```

`arn1` (Stockholm) is nearest to `eu-west-1` and to Swedish users; `dub1` is the alternative. Expected to remove the large majority of per-navigation latency on its own.

Note: `export const preferredRegion` is **deprecated in Next 16** and must not be used. Region belongs in `vercel.json` or Vercel project settings.

**Verify after deploy:** `curl -s -D - -o /dev/null https://avenro.se/login | grep -i x-vercel-id` should report `arn1::arn1`.

### 2. Client router cache — `next.config.ts`

```ts
experimental: { staleTimes: { dynamic: 30, static: 180 } }
```

`staleTimes.dynamic` defaults to **0** in Next 15+, so no dynamic route segment was ever reused — returning to a page cost full price every time. Every authenticated route is dynamic because the root layout reads `headers()` for the CSP nonce, so nothing was prerendered either.

**Safety precondition verified before enabling:** sign-out is a native `<form method="post" action="/auth/logout">` (`src/components/layout/WorkspaceSwitcher.tsx`), i.e. a full browser navigation, so the in-memory router cache cannot outlive a session. Workspace switching already calls `router.refresh()`.

### 4. Region: Stockholm, with hops removed instead

`arn1` is `eu-north-1` (Stockholm); the database is `eu-west-1` (Ireland), so a round trip still costs roughly 25-30 ms rather than the ~1-2 ms of true co-location. `dub1` **is** `eu-west-1` and would co-locate them, but Stockholm is the deliberate choice for Swedish visitor latency.

With the per-hop cost fixed by that decision, the remaining lever is the number of hops. Hence the `getClaims()` change above, and why collapsing the workspace bootstrap (below) is worth more here than it would be under co-location.

### Deliberately not changed

- `optimizePackageImports: ["lucide-react"]` — **already optimized by default** in Next 16; would be a no-op.
- `serverExternalPackages` — none of `stripe`, `@composio/core`, `@mendable/firecrawl-js`, `resend`, `@supabase/supabase-js` are in Next's default list, but opting out of bundling is a compatibility flag, not a demonstrated navigation win. Not added without evidence.

### 3. Analytics overview totals aggregated in Postgres

`fetchAllMatchingSummaryRows` paged `dashboard_conversation_summaries` 1000 rows at a time **with no upper bound**, then reduced them in JavaScript to four numbers: conversation count, message sum, lead sum, and the distinct active widgets. The transfer grew linearly with conversation volume while the answer stayed constant-size.

Replaced with `public.dashboard_conversation_analytics_totals` (migration `20260911160000`), a `security invoker` function granted to `service_role` only, with `search_path` locked. Filter semantics mirror `applySummaryRowFilters()` exactly, and the search term is escaped by the same `escapeIlikePattern()` helper so `ILIKE` behaviour is unchanged.

Verified against live data before switching — identical on every filter combination tested:

| | rows-in-JS (old) | aggregate (new) |
| --- | --- | --- |
| conversations | 346 | 346 |
| messages | 556 | 556 |
| leads | 2 | 2 |
| distinct widgets | 1 | 1 |
| completed-only conversations | 346 | 346 |
| completed-only messages | 556 | 556 |

Covered by `tests/security/dashboard-analytics-totals.test.ts`, which locks the filter parity, the escaping, and the no-privilege-widening properties.

## Remaining findings (not yet implemented)

Ordered by expected impact. **These should be re-prioritised against fresh measurements after the region change lands** — several may no longer justify their risk.

| Severity | Finding | Location |
| --- | --- | --- |
| ~~CRITICAL~~ **DONE** | `auth.getUser()` was a network round trip on every server render. Now `getClaims()`, verified locally against the project's ES256 key. Only the render path changed — 102 `getUser()` call sites remain, including all of billing and workspaces. Trade-off: a revoked session stays usable until token expiry. | `src/lib/app/request-context.ts`, `src/lib/app/verified-claims-user.ts` |
| HIGH | 9 handlers still call `getUser()` **and** `getSession()` back to back. | `api/agents/[id]/chat/route.ts:67,70` and 8 others |
| CRITICAL | Workspace bootstrap runs 3 serial DB round trips per request; the 30 s in-process `Map` cache is per-instance and misses on cold starts. Collapsible to one RPC. `cookies()` is read twice for the same value. | `src/lib/app/bootstrap.ts:367-417` |
| HIGH | Duplicate `workspace_subscriptions` fetch — context already has it. Independent queries serialized. | `src/lib/widgets/loader.ts:18,170-222` |
| HIGH | `AppShell` badge poll repeats the full auth + bootstrap chain; queries `widgets` twice internally. Needs `fallbackData`. | `AppShell.tsx:50-63`, `api/dashboard/latest-activity` |
| HIGH | `/milo` and `/website-chat` are redirect-only pages, so those sidebar items cost two full round trips and cannot be prefetched. | `milo/page.tsx:9`, `website-chat/page.tsx:9` |
| MEDIUM | Provider values are new object literals every render (`AppContext`, Toast, Modal, `SWRConfig`, `WidgetBuilderContext`) — a toast re-renders the sidebar and page. | `AppShell.tsx:211` and providers |
| ~~MEDIUM~~ **DONE** | Conversation analytics totals paged unbounded rows into Node to reduce them to four numbers. Replaced by the `dashboard_conversation_analytics_totals` aggregate (see below). | `dashboard/analytics.ts` |
| MEDIUM | `automation_events` still pages unbounded rows, but it builds a per-agent breakdown and a daily trend rather than scalar totals, so SQL aggregation is a larger change. Low urgency: 14 rows and 1 automation configured today. | `dashboard/analytics.ts:887-931` |
| MEDIUM | Whole i18n bundle (~100 KB source) serialized into every route's payload, including `/login`. | `src/app/layout.tsx:50` |
| MEDIUM | Large client components not code-split: `AnalyticsWorkspaceView` (1628), `KnowledgePageClient` (1580), `QuestionsPageClient` (1237), `CreateWorkspaceModal` (in the shell chunk). | various |
| MEDIUM | 4 separate `count: "exact"` queries for question statuses where one `GROUP BY` suffices. | `flywheel/server.ts:358-382` |
| LOW | 38 unused indexes / 16 unindexed FKs; `select("*")` pulling large jsonb/text columns; probable dead code in `loadWidgetSessionHistory` (`.maybeSingle()` with no limit errors on >1 message); N+1 in agent-library import. | see plan |

## Not problems (recorded so they are not re-investigated)

- **Database speed** — every hot query is 0.36–2.0 ms; no missing indexes on the navigation path.
- **Static asset caching** — `/_next/static` is `immutable` and CDN-cached.
- **Client-side auth calls** — there are none; `onAuthStateChange` appears nowhere.
- **Prefetch configuration** — the sidebar uses real `next/link`; `prefetch={false}` appears nowhere. Prefetching was limited by the missing client cache, not disabled.
- **`framer-motion` / `recharts`** — not dependencies of this app.

## Verification

Build, both typechecks, lint, and 300/300 tests pass. Baseline recorded before deploy: functions in `iad1`, `/login` TTFB ~250 ms, `/dashboard` proxy-only redirect ~94 ms.

Security posture is unchanged by this audit: no auth, RLS, tenant isolation, or quota behavior was modified.
