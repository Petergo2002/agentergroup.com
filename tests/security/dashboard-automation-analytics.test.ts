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
// The analytics view renders through the translation layer, so its user-facing
// copy is asserted where it now lives — in both locales, not inline in the JSX.
const analyticsEnSource = readFileSync("src/locales/en/analytics.ts", "utf8");
const analyticsSvSource = readFileSync("src/locales/sv/analytics.ts", "utf8");
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
  assert.match(analyticsViewSource, /analytics\.automationAgentsTitle/);
  assert.match(analyticsViewSource, /analytics\.automationRecentFailuresTitle/);
  assert.match(analyticsViewSource, /analytics\.automationTrendTitle/);
  assert.match(analyticsEnSource, /automationAgentsTitle: "Automation agents"/);
  assert.match(analyticsEnSource, /automationRecentFailuresTitle: "Recent failures"/);
  assert.match(analyticsSvSource, /automationAgentsTitle: "Automationsagenter"/);
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
  assert.match(
    analyticsViewSource,
    /<option value="live">\{t\("analytics\.statusLive"\)\}<\/option>/,
  );
  assert.match(
    analyticsViewSource,
    /<option value="idle">\{t\("analytics\.statusIdle"\)\}<\/option>/,
  );
  assert.match(analyticsEnSource, /statusLive: "Live visitors"/);
  assert.match(analyticsEnSource, /statusIdle: "Idle sessions"/);
  assert.match(analyticsSvSource, /statusLive: "Live-besökare"/);
  assert.match(analyticsSvSource, /statusIdle: "Inaktiva sessioner"/);
  assert.match(analyticsViewSource, /conversationResults/);
  assert.match(dashboardTypesSource, /DashboardConversationPresenceStatus = "live" \| "idle" \| "completed"/);
});
