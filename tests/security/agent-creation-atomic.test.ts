import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/agents/route.ts", "utf8");
const client = readFileSync("src/lib/agents/create-client.ts", "utf8");
const dropdown = readFileSync(
  "src/components/agents/CreateAgentDropdown.tsx",
  "utf8",
);
const modal = readFileSync(
  "src/components/modals/CreateAgentModal.tsx",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260725221200_phase_1c_atomic_agent_creation.sql",
  "utf8",
);

test("agent creation runs through the authenticated service-owned RPC boundary", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /ensureWorkspaceContext\(supabase as never, user\)/);
  assert.match(route, /createAdminClient\(\)/);
  assert.match(route, /\.rpc\("create_agent_v1"/);
  assert.match(route, /p_actor_id: user\.id/);
  assert.match(route, /p_workspace_id: context\.workspace\.id/);
  assert.match(route, /surface === "widget" \? "legacy_widget" : surface/);
});

test("agent creation is atomic and includes the initial draft", () => {
  assert.match(
    migration,
    /insert into public\.agents[\s\S]*returning id into created_agent_id/,
  );
  assert.match(
    migration,
    /insert into public\.agent_drafts[\s\S]*created_agent_id[\s\S]*returning id into created_draft_id/,
  );
});

test("browser creation surfaces no longer write protected tables directly", () => {
  for (const source of [dropdown, modal]) {
    assert.match(source, /createAgent\(\{/);
    assert.doesNotMatch(source, /\.from\(['"]agents['"]\)/);
    assert.doesNotMatch(source, /\.from\(['"]agent_drafts['"]\)/);
  }

  assert.match(client, /fetch\("\/api\/agents"/);
  assert.match(client, /requestId: crypto\.randomUUID\(\)/);
});

test("database limit failures remain product-safe", () => {
  assert.match(route, /includes\("AGENT_LIMIT_REACHED"\)/);
  assert.match(route, /code: "agent_limit_reached"/);
  assert.match(modal, /includes\('AGENT_LIMIT_REACHED'\)/);
});
