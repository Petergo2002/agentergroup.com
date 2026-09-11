# Agentergroup Production Performance Audit — Implementation Report

> [!WARNING]
> **ARCHIVED — 11 September 2026. Superseded by the September 11 audit.**
>
> A point-in-time implementation report for the 5 August 2026 build
> (Next.js 16.2.9 / React 19.2.4 — both since upgraded; 203 tests, now 355).
> Its seven implemented phases are still in the codebase and its reasoning
> remains sound, but its "next five actions" were re-prioritised once the
> September audit found the real bottleneck: functions running in `iad1`
> while the database sits in `eu-west-1`.
>
> Current performance source of truth:
> [Performance Audit 2026-09-11](../roadmap/performance-audit-2026-09-11.md).

Date: 2026-08-05  
Application: Next.js 16.2.9 / React 19.2.4 / Supabase / Vercel  
Repository: `/Users/petergorgees/Dev/Agentergroup/Agentergroup.com`

Scope note: this is a point-in-time implementation report. The versions above describe the audited August 5 build; use `package.json` and `package-lock.json` for the current dependency inventory.

## 1. Executive summary

The audit implemented seven small, separately verified performance phases. The largest authenticated rendering waterfall was removed by deduplicating user and workspace bootstrap work with request-scoped React `cache()`. Stored connection data now renders without waiting for third-party synchronization, connection snapshots persist in one batch, authenticated SWR caches are tenant-qualified, list loaders have defensive bounds, the Agent Builder's heavy flow editor is lazy-loaded, the login image and analytics icon font were reduced, chat paints immediately and propagates cancellation, and internal workspace navigation no longer discards the mounted application shell.

Authentication, RLS, workspace membership, subscription/quota checks, turn locks, active-workspace cookies, and message durability remain authoritative. No cross-request authenticated cache was introduced. No RLS policy was weakened. No service-role credential was moved to client code.

No database migration was applied. Live Supabase evidence did not justify a speculative index: the current hot access paths already have relevant indexes, core tables are small, and the advisor findings need query-specific evidence before accepting their write/storage cost.

Final verification is green: production build, TypeScript, lint, and 203/203 tests pass. The only observed warning is the pre-existing Node experimental Type Stripping warning emitted by the test runner.

## 2. Highest-impact findings and outcomes

| Severity | Path / function | Finding | Why it mattered | Implemented recommendation | Expected effect |
| --- | --- | --- | --- | --- | --- |
| High | `src/app/(app)/layout.tsx`, authenticated pages, `ensureWorkspaceContext()` | Layouts and pages repeated `auth.getUser()` and workspace/profile/membership/subscription bootstrap in one RSC request. | Every navigation paid duplicate Supabase/auth work. | Added `getAppRequestContext()` backed only by React request-scoped `cache()` and reused it across 11 RSC consumers. | App subtree direct calls changed from 11 `getUser()` + 10 bootstrap calls to 0 direct calls; one shared request result is reused. |
| High | connections/knowledge pages and builder bootstrap; `syncConnectedAccountsToDatabase()` | Third-party sync blocked initial HTML and wrote each account sequentially. | Navigation latency depended on Composio plus N database writes. | Render stored snapshots first, refresh stale data after hydration, and batch tenant-scoped upserts. | Removes third-party sync from TTFB and changes N snapshot writes into one upsert. |
| High | authenticated SWR consumers and list loaders | URL-only keys could retain the wrong workspace result; several lists were unbounded. | Workspace switching could show stale tenant data, and payloads could grow without limit. | Keys now include user and workspace; SWR boundary rotates by tenant; conservative query limits were added. | Tenant-safe reuse with bounded server payload/memory growth. |
| High | Agent Builder route and `@xyflow/react` | The initial client graph eagerly included the large builder/flow editor. | Large parse/evaluation cost before the editor was usable. | Moved the builder behind a stable client-only dynamic boundary and skeleton. | Initial route graph estimate fell from 745,965 raw / 211,610 gzip bytes to 163,520 / 51,563 (about 75.6% gzip reduction); the heavy editor remains an async chunk. |
| Medium | login hero and analytics icon font | Login used a 2,379,913-byte source; analytics requested a Google-hosted icon font. | Extra origin/image optimizer work and third-party font/DNS/CSS delay. | Added a 1,920×1,280, 284,501-byte hero and replaced analytics glyphs with local Lucide icons. | About 88.0% source-image reduction and removal of that analytics font request. |
| High | authenticated agent/assistant chat and runtime knowledge search | UI placeholder waited on network work; routes omitted cancellation; knowledge HTTP call had no bound; independent DB operations were sequential. | Slower perceived response and wasted model work after disconnects. | Render user + pending assistant immediately, let preview API create a missing thread, propagate `request.signal`, add an 8-second knowledge bound, and overlap audit/step plus history/step operations. | Immediate paint, fewer pre-model round trips, bounded retrieval stalls, and cancelled model/knowledge work on disconnect. |
| High | workspace switch/create/delete and invite navigation | Same-origin actions used `window.location`, unloading the App Router shell and client state. | Full document reload made tenant navigation feel slow. | Use `router.replace`/`push` plus one authoritative refresh after the server cookie mutation; keep pending/error handling. | Preserves shell, route cache, and responsive navigation while re-resolving tenant context safely. |

## 3. Implemented changes by phase

### Phase 1 — Request-scoped authentication/workspace context

Changed files:

- `src/lib/app/request-context-core.ts` — testable authenticated context loader.
- `src/lib/app/request-context.ts` — server-only React `cache()` wrapper; request scope only.
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/widgets/page.tsx`
- `src/app/(app)/knowledge/page.tsx`
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/leads/page.tsx`
- `src/app/(app)/questions/page.tsx`
- `src/app/(app)/assistants/layout.tsx`
- `src/app/(app)/assistants/page.tsx`
- `src/app/(app)/widgets/[id]/preview/page.tsx`
- `src/lib/dashboard/summary.ts` — context-aware RSC loader avoids another bootstrap while preserving the API-facing loader.
- `tests/security/request-context.test.ts` — multiple workspaces, no-workspace bootstrap, expired session, next-request workspace switching, and cache contract.

Security: no `unstable_cache`, module-global result, or cross-user cache. Active workspace resolution and subscription loading are unchanged.

### Phase 2 — Non-blocking connection synchronization

Changed files:

- `src/lib/connection-sync.ts` — builds workspace/user-scoped rows and performs one batch persistence operation.
- `src/lib/composio.ts` — replaces sequential per-account upserts.
- `src/lib/connections.ts` — snapshot freshness helper.
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/connections/ConnectionsPageClient.tsx` — renders stored data and refreshes missing/stale data after hydration; forced manual refresh remains available.
- `src/app/(app)/knowledge/page.tsx`
- `src/lib/agents/builder-bootstrap.ts`
- `tests/security/connection-sync-performance.test.ts`

Security: every persisted row carries the resolved workspace and creator identity. Existing RLS and the unique `(workspace_id, toolkit_slug)` constraint remain intact.

### Phase 3 — Tenant-safe client caching and bounded lists

Changed files:

- `src/lib/json-fetcher.ts` — tuple key `[userId, workspaceId, url]` support.
- `src/lib/query-limits.ts` — agents 250, widgets 250, connections 100, knowledge sources 500, folders 250, builder versions 100, assistants 100.
- `src/components/layout/AppShell.tsx` — tenant-qualified latest activity and SWR boundary key.
- `src/components/analytics/AnalyticsWorkspaceView.tsx`
- `src/components/leads/LeadsPageClient.tsx`
- `src/app/(app)/questions/QuestionsPageClient.tsx`
- `src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx`
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/widgets/page.tsx`
- `src/lib/widgets/loader.ts`
- `src/app/(app)/knowledge/page.tsx`
- `src/app/(app)/connections/page.tsx`
- `src/app/(app)/questions/page.tsx`
- `src/lib/agents/builder-bootstrap.ts`
- `src/app/(app)/assistants/page.tsx`
- `src/lib/assistants/server.ts`
- `tests/security/tenant-cache-and-query-bounds.test.ts`

Security: authenticated cached values cannot collide across users or workspaces. Bounds are above current product limits and do not broaden access.

### Phase 4 — Agent Builder lazy loading

Changed files:

- `src/app/(app)/agents/[id]/builder/page.tsx` — small dynamic-loader boundary and stable three-column skeleton.
- `src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx` — existing full builder moved behind the async boundary.
- `tests/security/builder-lazy-load.test.ts`
- `tests/security/automation-activity.test.ts`
- `tests/security/knowledge-tenant-hardening.test.ts`
- `tests/security/tenant-cache-and-query-bounds.test.ts`

Risk: editor code now downloads on entering the builder rather than in its initial route graph. The loading skeleton prevents layout collapse; builder state behavior remains in the original client component.

### Phase 5 — Images and fonts

Changed files:

- `public/login-robot-hero.jpg` — right-sized derivative, visually inspected.
- `src/app/login/page.tsx` — uses the derivative.
- `src/app/(app)/analytics/layout.tsx` — removes Google Material Symbols resource hints/styles.
- `src/components/analytics/AnalyticsWorkspaceView.tsx` — replaces eight glyph usages with Lucide components.
- `tests/security/resource-performance.test.ts`

Risk: the original source remains in `public/` for a recoverable rollout. It is no longer referenced by login and can be removed in a later asset-cleanup commit after production visual confirmation.

### Phase 6 — AI first-token and immediate rendering

Changed files:

- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/app/(app)/assistants/[id]/page.tsx`
- `src/app/api/agents/[id]/chat/route.ts`
- `src/app/api/assistants/[id]/chat/route.ts`
- `src/lib/runtime/agent-chat.ts`
- `tests/security/ai-response-performance.test.ts`

Security/durability: authentication, workspace resolution, agent access, quotas, assistant turn locks, run creation, and user-message persistence still precede model execution. Knowledge timeout is fail-open only for optional retrieval; an actual client abort is rethrown and stops runtime work.

### Phase 7 — App Router workspace navigation

Changed files:

- `src/components/layout/WorkspaceSwitcher.tsx`
- `src/components/modals/CreateWorkspaceModal.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/team/page.tsx`
- `tests/security/app-navigation-performance.test.ts`

Security: `/api/workspaces/active` remains the authority, confirms membership, returns 403 for non-members, and writes the HttpOnly active-workspace cookie. Local UI does not claim the new tenant before server success. Stripe and other external redirects remain document navigations.

### Existing user changes preserved

The worktree was already dirty. Unrelated pre-existing edits were not reverted, reformatted wholesale, or claimed as performance work. They include UI changes in agent/dashboard/knowledge/sidebar/lead/modal/toast/global-style files and `docs/PLAN-ui-ux-refinement.md`. `AnalyticsWorkspaceView.tsx` had existing edits and received only the targeted icon replacement described above.

## 4. Supabase/PostgreSQL evidence and migration disposition

Live production was inspected through Supabase before database decisions.

Confirmed connection schema and security:

- `connections` has the fields used by synchronization.
- Unique index/constraint exists on `(workspace_id, toolkit_slug)`.
- Supporting indexes exist for workspace/status, workspace/display name, workspace ID, and creator.
- `connections_member_access` enforces `private.is_workspace_member(workspace_id)`; writes additionally require `created_by = auth.uid()`.

Production query evidence:

- Two cumulative connection insert/upsert forms recorded 7,940 calls / 56,005.93 ms total / 7.05 ms mean and 1,282 calls / 17,624.67 ms / 13.75 ms mean. This supported batching application writes rather than adding an index.
- Core table sizes at inspection were small: 3 agents, 1 widget, 2 knowledge sources, 2 leads, 145 runs, 282 messages, and 425 widget sessions.
- `close_stale_widget_sessions` was the largest cumulative background function (8,965 calls, about 71.92 ms mean), but it is bounded, lock-safe, already uses a targeted partial index, and is outside user request paths.
- The advisor reported 16 unindexed foreign keys, 39 unused indexes, one multiple-permissive-policy warning for `agents` UPDATE, and no RLS `auth.uid()` initialization-plan warnings.

Migration result: **none created or applied**. No production-only SQL was run. The evidence did not support an additive index with a clear latency benefit. Removing the legacy `agents` update policy would be security-sensitive and needs access-equivalence proof plus explicit approval.

## 5. Remaining risks and opportunities

1. Several detail/runtime paths still use `select("*")`. They are not all incorrect, but message history and detail payloads should be replaced with explicit schemas only alongside tool-message compatibility tests.
2. Authenticated chat history remains unbounded. A safe cap must retain coherent user/assistant/tool-call groups and include summarization or cursor semantics; a blind `.limit()` could corrupt model context.
3. The builder heavy async chunk remains about 329,900 raw / 89,512 gzip bytes. The initial route is much smaller, but panel-level extraction could reduce time after entering the builder.
4. The broad app loading fallback and some client-only skeletons can still be refined, but route-specific skeletons already exist and this was lower impact than the completed waterfalls.
5. `ensureWorkspaceContext()` still includes first-run ensure/synchronization behavior in ordinary API authorization paths. Splitting read-only lookup from account provisioning is worthwhile only with lifecycle and race tests.
6. The 16 advisor-reported unindexed foreign keys should not be indexed wholesale. Revisit only when query statistics or `EXPLAIN (ANALYZE, BUFFERS)` show a real join/delete/RLS path.
7. The multiple permissive `agents` UPDATE policies should be audited for rollout intent. Do not remove either policy without proving equivalent authorization.
8. Real-user TTFR, LCP, navigation, and Supabase latency telemetry is not currently captured in this local audit. Source/build metrics predict improvement but do not replace production RUM.

## 6. Verification and measurements

| Gate | Baseline | Final | Result |
| --- | ---: | ---: | --- |
| Production build | Passed | Passed; 8.9 s compile, 7.8 s TypeScript, 71 static pages | Green |
| Direct TypeScript | Passed | `npx tsc --noEmit --incremental false` passed | Green |
| Lint | Passed | `npm run lint` passed | Green |
| Tests | 179/179 | 203/203 | Green; 24 added tests |
| Existing failures | None | None | No regression |
| Warnings | Node experimental Type Stripping | Same warning | Existing, not introduced |
| App subtree auth/bootstrap source calls | 11 + 10 | 0 direct; 11 cached consumers | Reduced |
| Builder initial client graph estimate | 745,965 raw / 211,610 gzip | 163,520 raw / 51,563 gzip | ~75.6% gzip reduction |
| Login source image | 2,379,913 bytes | 284,501 bytes | ~88.0% reduction |
| Connection snapshot persistence | N sequential upserts | 1 batch upsert | N → 1 DB writes |

Bundle figures are generated-manifest graph estimates, not measured browser transfer sizes. Build timings naturally vary between runs; they are reported as verification, not a claimed latency delta.

## 7. Performance scorecard

| Area | Before | After | Confidence |
| --- | --- | --- | --- |
| Authenticated RSC request efficiency | Poor — repeated bootstrap | Strong — request-scoped dedupe | High |
| Workspace/tenant cache isolation | Risky URL-only keys | Strong user+workspace keys | High |
| Connection page TTFB | Third-party dependent | Stored snapshot first | High |
| List growth safety | Mixed/unbounded | Conservative server bounds on major lists | High |
| Builder initial JS | Very heavy | Heavy editor async | High |
| Login/analytics resources | Oversized source + remote icon font | Right-sized source + local icons | High |
| Chat perceived responsiveness | Network wait before pending UI | Immediate optimistic user/assistant paint | High |
| Chat cancellation/stalls | Incomplete cancellation; unbounded knowledge fetch | Request cancellation + 8 s retrieval bound | High |
| Internal workspace navigation | Full document reload | App Router shell preserved | High |
| Database index posture | Advisor noise could invite over-indexing | Evidence-based; no speculative migration | High |
| Production RUM evidence | Not available | Still not available | Low / next step |

## 8. Prioritized next five actions

1. Add production RUM for workspace navigation duration, RSC TTFB, LCP/INP, chat request-to-meta, and chat time-to-first-token, tagged by route and anonymized workspace plan—not workspace ID.
2. Design a tool-call-safe bounded chat-history loader (group-aware cursor plus summary) and validate TTFR with representative 100/500/1,000-message threads.
3. Split the Agent Builder's largest secondary panels into on-demand chunks and measure post-navigation editor-interactive time, not only manifest size.
4. Separate read-only authenticated workspace lookup from first-run profile/workspace provisioning, with concurrency tests for signup, expired sessions, and workspace deletion/switching.
5. Review the duplicate `agents` UPDATE policy and advisor-reported foreign keys using production query patterns and `EXPLAIN`; create a migration only when authorization equivalence and measurable benefit are proven.
