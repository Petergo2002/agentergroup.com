import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260713183430_atomic_agent_widget_plan_limits.sql",
  "utf8",
);
const agentModal = readFileSync(
  "src/components/modals/CreateAgentModal.tsx",
  "utf8",
);
const agentImportRoute = readFileSync(
  "src/app/api/agent-library/[id]/import/route.ts",
  "utf8",
);
const widgetRoute = readFileSync("src/app/api/widgets/route.ts", "utf8");

test("agent capacity is serialized and enforced for creates and restores", () => {
  assert.match(migration, /private\.enforce_agent_plan_limit/);
  assert.match(
    migration,
    /pg_advisory_xact_lock\([\s\S]*'agent-plan-limit:'[\s\S]*\)/,
  );
  assert.match(
    migration,
    /workspace_subscriptions\.agents_limit[\s\S]*for update/,
  );
  assert.match(
    migration,
    /from public\.agents[\s\S]*agents\.archived_at is null/,
  );
  assert.match(migration, /raise exception 'AGENT_LIMIT_REACHED'/);
  assert.match(
    migration,
    /before insert or update of archived_at, workspace_id on public\.agents/,
  );
});

test("widget capacity matches application plan values and is concurrency-safe", () => {
  assert.match(migration, /private\.enforce_widget_plan_limit/);
  assert.match(
    migration,
    /pg_advisory_xact_lock\([\s\S]*'widget-plan-limit:'[\s\S]*\)/,
  );
  assert.match(
    migration,
    /when 'premium' then 6[\s\S]*when 'starter' then 3[\s\S]*else 1/,
  );
  assert.match(migration, /raise exception 'WIDGET_LIMIT_REACHED'/);
  assert.match(
    migration,
    /before insert or update of workspace_id on public\.widgets/,
  );
});

test("database limit errors are translated into product-safe responses", () => {
  assert.match(agentModal, /includes\('AGENT_LIMIT_REACHED'\)/);
  assert.match(agentImportRoute, /includes\("AGENT_LIMIT_REACHED"\)/);
  assert.match(widgetRoute, /includes\("WIDGET_LIMIT_REACHED"\)/);
  assert.match(widgetRoute, /code: "widget_limit_reached"/);
});

test("plan trigger functions are invoker-safe and not directly callable", () => {
  assert.match(
    migration,
    /private\.enforce_agent_plan_limit\(\)[\s\S]*security invoker/,
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_agent_plan_limit\(\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /private\.enforce_widget_plan_limit\(\)[\s\S]*security invoker/,
  );
});
