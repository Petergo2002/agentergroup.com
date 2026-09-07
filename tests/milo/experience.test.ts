import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasValidMiloMapping,
  isMiloMode,
  isMiloNavItemActive,
} from "../../src/lib/milo/experience.ts";

const mappedWorkspace = {
  product_experience: "milo" as const,
  primary_customer_agent_id: "11111111-1111-4111-8111-111111111111",
  primary_widget_id: "22222222-2222-4222-8222-222222222222",
};

test("Milo mode requires the switch, opt-in, and both primary resources", () => {
  assert.equal(hasValidMiloMapping(mappedWorkspace), true);
  assert.equal(isMiloMode(mappedWorkspace, true), true);
  assert.equal(isMiloMode(mappedWorkspace, false), false);
  assert.equal(
    isMiloMode({ ...mappedWorkspace, primary_widget_id: null }, true),
    false,
  );
  assert.equal(
    isMiloMode({ ...mappedWorkspace, product_experience: "classic" }, true),
    false,
  );
});

test("stable nav entries remain active after resource redirects", () => {
  assert.equal(
    isMiloNavItemActive(
      `/agents/${mappedWorkspace.primary_customer_agent_id}/builder`,
      "/milo",
      mappedWorkspace,
    ),
    true,
  );
  assert.equal(
    isMiloNavItemActive(
      `/widgets/${mappedWorkspace.primary_widget_id}`,
      "/website-chat",
      mappedWorkspace,
    ),
    true,
  );
  assert.equal(isMiloNavItemActive("/analytics", "/milo", mappedWorkspace), false);
});

test("Website Chat keeps Milo's primary widget in the focused full-screen shell", () => {
  const appShell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
  const builderHeader = readFileSync(
    "src/components/widgets/builder/WidgetBuilderHeader.tsx",
    "utf8",
  );
  const websiteChatLoading = readFileSync(
    "src/app/(app)/website-chat/loading.tsx",
    "utf8",
  );

  assert.match(appShell, /primaryWebsiteChatPath/);
  assert.match(appShell, /pathname === primaryWebsiteChatPath/);
  assert.match(appShell, /workspace\.product_experience === "milo"/);
  assert.match(builderHeader, /isPrimaryMiloWidget[\s\S]*href="\/dashboard"/);
  assert.match(websiteChatLoading, /min-h-screen/);
  assert.match(websiteChatLoading, /href="\/dashboard"/);
});

test("Milo provisioning is transactional, idempotent, and protected", () => {
  const migration = readFileSync(
    "supabase/migrations/20260811221031_milo_primary_workspace_resources.sql",
    "utf8",
  );
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /on conflict \(widget_id, agent_id\) do nothing/);
  assert.match(migration, /MILO_PROVISION_AMBIGUOUS_AGENTS/);
  assert.match(migration, /MILO_PRIMARY_AGENT_PROTECTED/);
  assert.match(migration, /MILO_PRIMARY_WIDGET_PROTECTED/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/);
});

test("Milo API guards keep one customer agent, widget, and link", () => {
  const agentRoute = readFileSync("src/app/api/agents/route.ts", "utf8");
  const widgetRoute = readFileSync("src/app/api/widgets/route.ts", "utf8");
  const linkRoute = readFileSync("src/app/api/widgets/[id]/agents/route.ts", "utf8");
  assert.match(agentRoute, /milo_agent_already_exists/);
  assert.match(widgetRoute, /primary_widget_already_exists/);
  assert.match(linkRoute, /milo_primary_link_protected/);
});

test("Milo dashboard prioritizes leads and unanswered questions", () => {
  const dashboard = readFileSync("src/components/dashboard/StatsGrid.tsx", "utf8");
  const summary = readFileSync("src/lib/dashboard/summary.ts", "utf8");

  const leadsPosition = dashboard.indexOf('t("dashboard.leads")');
  const improveMiloPosition = dashboard.indexOf('t("dashboard.improveMilo")');

  assert.ok(leadsPosition >= 0);
  assert.ok(improveMiloPosition > leadsPosition);
  assert.match(dashboard, /value: miloMode \? stats\.leads : stats\.totalAgents/);
  assert.match(
    dashboard,
    /value: miloMode \? stats\.unansweredQuestions : stats\.liveWidgets/,
  );
  assert.match(summary, /\.from\("unanswered_queries"\)/);
  assert.match(summary, /\.eq\("status", "open"\)/);
});
