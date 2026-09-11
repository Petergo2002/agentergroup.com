# PLAN: Widget V2 Performance & Logic Remediation

**Slug:** `widget-v2-fixes`  
**Status: COMPLETE — verified 11 September 2026.** Retained as the implementation
record for this remediation; no open work remains on this board.  
**Priority:** High  
**Agent Assignments:** `@[backend-specialist]`, `@[frontend-specialist]`  

---

## 1. Overview & Objective

Remediate the verified bottlenecks in the Widget V2 system:
1. **Lead Summarization Logic**: Stop early-freeze bug where summaries never update after first `ready` state.
2. **Database Trigger Amplification**: Fast-path `widget_sessions` updates so 30s heartbeats and 5,000-row `close_stale_widget_sessions` pg_cron sweeps do not execute heavy lateral message joins.
3. **Dead Code & Hygiene**: Delete defective `loadWidgetSessionHistory` and dead `/config` route; deduplicate agent selection.

---

## 2. Task Breakdown

### Phase 1: Lead Conversation Summaries (Rank 1)
- [x] In `src/lib/leads/conversation-summary.ts`:
  - Corrected `shouldKeepReadySummary` caching condition so that if `sourceHash` has changed, summaries are refreshed.
  - Guarded against retry storms on failed attempts with identical source hashes.
  - Verified `after()` in `chat/route.ts` and `leads/route.ts` correctly schedules updates.

### Phase 2: Database Trigger Fast-Path Migration (Rank 2)
- [x] Created `supabase/migrations/20260911180000_optimize_widget_session_summary_triggers.sql`:
  - Updated `private.refresh_dashboard_conversation_summary_from_session()` to:
    - Skip turn lock mutations (`active_turn_request_id`) via early return.
    - Fast-path `last_seen_at` updates directly to `dashboard_conversation_summaries.last_activity_at` via primary key indexed update (~0.1ms).
    - Fast-path `status = 'completed'` transitions directly to `dashboard_conversation_summaries.status`.
    - Only run full lateral aggregates on structural session changes or inserts.

### Phase 3: Dead Code Removal & Refactoring (Rank 3 & 4)
- [x] Removed defective `loadWidgetSessionHistory` from `src/lib/widgets/session.ts` and `src/lib/widgets/server.ts`.
- [x] Deleted dead route `src/app/api/public/widgets/[widgetPublicKey]/config/route.ts`.
- [x] Removed `getWidgetConfig` from `apps/widget-v2/src/lib/api.ts`.
- [x] Extracted `resolveSelectedWidgetAgent` into `src/lib/widgets/selection.ts` and imported in `chat/route.ts` and `leads/route.ts`.
- [x] Aligned `bootstrap/route.ts` `OPTIONS` handler to return 204 with clean CORS headers.

---

## 3. Verification & Validation
- [x] Ran `npm run typecheck` (`tsc --noEmit`): 0 errors.
- [x] Ran `npm run lint` (`eslint`): 0 errors, 0 warnings.
- [x] Ran `npm test`: 350/350 tests passing.
- [x] Ran `npm run widget:typecheck`: 0 errors.
- [x] Ran `npm run build`: Next.js production build succeeded in 1.8s.
- [x] Verified database trigger fast-path logic against PostgreSQL syntax.
