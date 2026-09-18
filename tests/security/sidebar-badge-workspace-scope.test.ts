import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "src/app/api/dashboard/latest-activity/route.ts",
  "utf8",
);
const appShell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
const analytics = readFileSync("src/lib/dashboard/analytics.ts", "utf8");

test("the badge request names its workspace instead of letting the server guess", () => {
  // The response is browser-cached for 15s. With one URL for every workspace,
  // switching workspaces replayed the previous workspace's badge counts.
  assert.match(
    appShell,
    /\/api\/dashboard\/latest-activity\?workspaceId=\$\{encodeURIComponent\(/,
  );
  assert.match(route, /searchParams\s*\n?\s*\.get\("workspaceId"\)/);
});

test("a caller cannot read a workspace they do not belong to", () => {
  // The workspace now comes from a client-supplied parameter, so it has to be
  // checked against the caller's own memberships.
  assert.match(
    route,
    /context\.workspaces\.some\(\s*\n?\s*\(entry\) => entry\.workspace\.id === requestedWorkspaceId,?\s*\n?\s*\)/,
  );
  assert.match(route, /status: 404/);

  const membershipCheck = route.indexOf("context.workspaces.some");
  const assignment = route.indexOf("workspaceId = requestedWorkspaceId");
  assert.ok(membershipCheck > 0 && assignment > membershipCheck);
});

test("an absent workspace parameter still falls back to the active one", () => {
  // Older clients and direct requests must keep working.
  assert.match(route, /let workspaceId = context\.workspace\.id;/);
});

test("the badge counts are scoped to the workspace's own widgets", () => {
  // The server query was never the problem, and must not become one.
  assert.match(
    analytics,
    /from\("widgets"\)\s*\n?\s*\.select\("id"\)\s*\n?\s*\.eq\("workspace_id", workspaceId\)/,
  );
  assert.match(analytics, /\.eq\("workspace_id", workspaceId\)\s*\n?\s*\.eq\("status", "open"\)/);
});

test("the activity cache is keyed per workspace", () => {
  assert.match(analytics, /latestActivityCache\.get\(workspaceId\)/);
  assert.match(analytics, /latestActivityCache\.delete\(workspaceId\)/);
});
