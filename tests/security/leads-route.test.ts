import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leadsRouteSource = readFileSync("src/app/api/leads/route.ts", "utf8");
const latestActivitySource = readFileSync(
  "src/lib/dashboard/analytics.ts",
  "utf8",
);

test("leads API authenticates and resolves the active workspace before admin reads", () => {
  const authLookup = leadsRouteSource.indexOf("supabase.auth.getUser()");
  const workspaceLookup = leadsRouteSource.indexOf(
    "await ensureWorkspaceContext",
  );
  const adminLookup = leadsRouteSource.indexOf("const admin = createAdminClient()");

  assert.ok(authLookup >= 0);
  assert.ok(workspaceLookup > authLookup);
  assert.ok(adminLookup > workspaceLookup);
  assert.match(leadsRouteSource, /status: 401/);
});

test("leads API scopes the joined widget query to the authenticated workspace", () => {
  assert.match(leadsRouteSource, /widgets!inner\(name, workspace_id\)/);
  assert.match(
    leadsRouteSource,
    /\.eq\("widgets\.workspace_id", context\.workspace\.id\)/,
  );
  assert.doesNotMatch(leadsRouteSource, /searchParams\.get\("workspace/);
});

test("sidebar lead count is derived from workspace-owned widget ids", () => {
  assert.match(latestActivitySource, /\.from\("widgets"\)/);
  assert.match(latestActivitySource, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(latestActivitySource, /\.from\("widget_leads"\)/);
  assert.match(latestActivitySource, /\.in\("widget_id", widgetIds\)/);
});
