import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const analyticsHelperSource = readFileSync(
  "src/lib/dashboard/analytics.ts",
  "utf8",
);
const analyticsRouteSource = readFileSync(
  "src/app/api/dashboard/analytics/route.ts",
  "utf8",
);
const analyticsViewSource = readFileSync(
  "src/components/analytics/AnalyticsWorkspaceView.tsx",
  "utf8",
);
const dashboardTypesSource = readFileSync(
  "src/lib/types/dashboard.ts",
  "utf8",
);
const automationAnalyticsStart = analyticsHelperSource.indexOf(
  "async function fetchAutomationEventsForAnalytics",
);
const automationAnalyticsEnd = analyticsHelperSource.indexOf(
  "/**\n * Counts leads",
  automationAnalyticsStart,
);
const automationAnalyticsBlock = analyticsHelperSource.slice(
  automationAnalyticsStart,
  automationAnalyticsEnd,
);

test("dashboard analytics returns workspace automation reporting without raw event payloads", () => {
  assert.match(analyticsHelperSource, /getDashboardAutomationAnalytics/);
  assert.match(analyticsHelperSource, /from\("automation_events"\)/);
  assert.match(analyticsHelperSource, /readAutomationRunResult/);
  assert.match(analyticsHelperSource, /automationStatus/);
  assert.match(analyticsHelperSource, /trendByDate/);
  assert.match(
    analyticsHelperSource,
    /activityHref: `\/agents\/\$\{event\.agent_id\}\/activity\?event=\$\{event\.id\}`/,
  );
  assert.notEqual(automationAnalyticsStart, -1);
  assert.notEqual(automationAnalyticsEnd, -1);
  assert.doesNotMatch(automationAnalyticsBlock, /payload/);
});

test("dashboard analytics route exposes automation summaries with status filtering", () => {
  assert.match(analyticsRouteSource, /parseAutomationStatus/);
  assert.match(analyticsRouteSource, /getDashboardAutomationAnalytics/);
  assert.match(analyticsRouteSource, /automationStatus: appliedFilters\.automationStatus/);
  assert.match(analyticsRouteSource, /automation,/);
});

test("analytics workspace shows automation summaries and links failures back to Activity", () => {
  assert.match(analyticsViewSource, /AutomationPerformancePanel/);
  assert.match(analyticsViewSource, /Automation agents/);
  assert.match(analyticsViewSource, /Recent failures/);
  assert.match(analyticsViewSource, /Success and failure trend/);
  assert.match(analyticsViewSource, /href=\{failure\.activityHref\}/);
  assert.match(analyticsViewSource, /automationStatus/);
  assert.match(dashboardTypesSource, /DashboardAutomationAnalytics/);
  assert.match(dashboardTypesSource, /DashboardAutomationTrendPoint/);
});

test("dashboard analytics separates live, idle, and completed conversation states", () => {
  assert.match(analyticsHelperSource, /WIDGET_LIVE_HEARTBEAT_WINDOW_MS = 90 \* 1000/);
  assert.match(analyticsHelperSource, /resolveConversationPresenceStatus/);
  assert.match(analyticsHelperSource, /\.gt\("last_activity_at", input\.liveCutoffIso\)/);
  assert.match(analyticsHelperSource, /\.lte\("last_activity_at", input\.liveCutoffIso\)/);
  assert.match(analyticsRouteSource, /value === "active"[\s\S]*return "live"/);
  assert.match(analyticsViewSource, /<option value="live">Live visitors<\/option>/);
  assert.match(analyticsViewSource, /<option value="idle">Idle sessions<\/option>/);
  assert.match(analyticsViewSource, /conversationResults/);
  assert.match(dashboardTypesSource, /DashboardConversationPresenceStatus = "live" \| "idle" \| "completed"/);
});
