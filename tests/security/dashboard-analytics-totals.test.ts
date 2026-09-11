import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const analyticsSource = readFileSync("src/lib/dashboard/analytics.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260911160000_dashboard_analytics_totals_rpc.sql",
  "utf8",
);

test("analytics overview totals are aggregated in Postgres, not by transferring rows", () => {
  // The unbounded pager over the summaries table is gone. (The separate
  // automation_events pager is still row-based by necessity — it builds a
  // per-agent breakdown and a daily trend, not four numbers — so this asserts
  // only that the summaries path no longer pages.)
  assert.doesNotMatch(analyticsSource, /fetchAllMatchingSummaryRows/);
  assert.doesNotMatch(analyticsSource, /matchingSummaries/);
  assert.equal(
    analyticsSource.match(/for \(let offset = 0; ; offset \+= pageSize\)/g)?.length,
    1,
    "only the automation_events pager should remain",
  );
  assert.doesNotMatch(
    analyticsSource.slice(
      analyticsSource.indexOf("async function fetchSummaryTotals"),
      analyticsSource.indexOf("async function fetchPagedSummaryRows"),
    ),
    /offset/,
  );

  // Totals now come from one aggregate call.
  assert.match(
    analyticsSource,
    /supabase\.rpc\(\s*"dashboard_conversation_analytics_totals"/,
  );
  assert.match(migration, /count\(\*\)::bigint as conversation_count/);
  assert.match(migration, /coalesce\(sum\(s\.message_count\), 0\)::bigint/);
  assert.match(migration, /coalesce\(sum\(s\.lead_count\), 0\)::bigint/);
  assert.match(migration, /array_agg\(distinct s\.widget_id\)/);
});

test("the aggregate keeps the app's filter semantics", () => {
  // Every filter applySummaryRowFilters() applies must exist in the function.
  assert.match(migration, /s\.workspace_id = p_workspace_id/);
  assert.match(migration, /s\.last_activity_at >= p_start/);
  assert.match(migration, /p_widget_id is null or s\.widget_id = p_widget_id/);
  assert.match(migration, /p_agent_id is null or s\.active_agent_id = p_agent_id/);
  assert.match(migration, /p_session_status = 'completed' and s\.status = 'completed'/);
  assert.match(
    migration,
    /p_session_status = 'live'[\s\S]*s\.status = 'active'[\s\S]*s\.last_activity_at > p_live_cutoff/,
  );
  assert.match(
    migration,
    /p_session_status = 'idle'[\s\S]*s\.status = 'active'[\s\S]*s\.last_activity_at <= p_live_cutoff/,
  );
  // "all" (and anything else) must not filter by status.
  assert.match(migration, /p_session_status not in \('completed', 'live', 'idle'\)/);

  // Search is escaped by the same helper the direct queries use, so ILIKE
  // wildcards in user input cannot change the match semantics.
  assert.match(
    analyticsSource,
    /p_search: input\.search \? escapeIlikePattern\(input\.search\) : null/,
  );
  assert.match(migration, /s\.search_text ilike '%' \|\| p_search \|\| '%'/);
});

test("the aggregate never widens data access", () => {
  // security invoker + locked search_path, service_role only — no elevation
  // over the direct table reads it replaces.
  assert.match(migration, /security invoker/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/);

  // Workspace scoping is inside the function, not only at the call site.
  assert.match(migration, /where s\.workspace_id = p_workspace_id/);
});

test("deployment filtering for active widgets is preserved", () => {
  assert.match(
    analyticsSource,
    /summaryTotals\.widgetIds\.filter\(\s*\(widgetId\) => widgetStatusById\.get\(widgetId\) === "deployed"/,
  );
  assert.match(analyticsSource, /conversationCount: summaryTotals\.conversationCount/);
  assert.match(analyticsSource, /messageCount: summaryTotals\.messageCount/);
  assert.match(analyticsSource, /leadCount: summaryTotals\.leadCount/);
});
