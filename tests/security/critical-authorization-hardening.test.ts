import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const MIGRATIONS_DIRECTORY = "supabase/migrations";
const hardeningMigration = readFileSync(
  `${MIGRATIONS_DIRECTORY}/20260713183314_critical_authorization_hardening.sql`,
  "utf8",
);
const knowledgeMigration = readFileSync(
  `${MIGRATIONS_DIRECTORY}/20260713183356_atomic_knowledge_text_updates.sql`,
  "utf8",
);
const knowledgeWriteContractMigration = readFileSync(
  `${MIGRATIONS_DIRECTORY}/20260713192609_restrict_knowledge_source_direct_writes_after_app_deploy.sql`,
  "utf8",
);

type PolicyState = Map<string, string>;

function getCumulativePolicyState(): PolicyState {
  const policies: PolicyState = new Map();
  const migrationFiles = readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const policyEvent = new RegExp(
    [
      'create\\s+policy\\s+"([^"]+)"\\s+on\\s+([a-z_][\\w]*\\.[a-z_][\\w]*)',
      'drop\\s+policy\\s+(?:if\\s+exists\\s+)?"([^"]+)"\\s+on\\s+([a-z_][\\w]*\\.[a-z_][\\w]*)',
    ].join("|"),
    "giu",
  );

  for (const fileName of migrationFiles) {
    const sql = readFileSync(`${MIGRATIONS_DIRECTORY}/${fileName}`, "utf8");

    for (const match of sql.matchAll(policyEvent)) {
      const createdPolicy = match[1];
      const createdTable = match[2]?.toLowerCase();
      const droppedPolicy = match[3];
      const droppedTable = match[4]?.toLowerCase();

      if (createdPolicy && createdTable) {
        policies.set(`${createdTable}::${createdPolicy}`, fileName);
      } else if (droppedPolicy && droppedTable) {
        policies.delete(`${droppedTable}::${droppedPolicy}`);
      }
    }
  }

  return policies;
}

test("cumulative migrations remove legacy public attachment and member agent deletion policies", () => {
  const policies = getCumulativePolicyState();

  assert.equal(policies.has("storage.objects::Public Access"), false);
  assert.equal(policies.has("public.agents::agents_member_delete"), false);
  assert.equal(policies.has("public.agents::agents_owner_delete"), true);
  assert.equal(
    policies.has("storage.objects::Workspace Member Access widget-attachments"),
    true,
  );
});

test("profile writes expose only safe columns and keep admin state immutable", () => {
  assert.match(
    hardeningMigration,
    /revoke insert, update on table public\.profiles from anon, authenticated/,
  );
  assert.match(
    hardeningMigration,
    /grant insert \(id, email, full_name, avatar_url\)[\s\S]*to authenticated/,
  );
  assert.match(
    hardeningMigration,
    /grant update \(email, full_name, avatar_url\)[\s\S]*to authenticated/,
  );
  assert.match(hardeningMigration, /protect_profile_admin_flag/);
  assert.match(hardeningMigration, /new\.is_admin is distinct from old\.is_admin/);
});

test("agent identity and permanent deletion rules are enforced in Postgres", () => {
  assert.match(hardeningMigration, /protect_agent_identity_fields/);
  assert.match(
    hardeningMigration,
    /new\.workspace_id is distinct from old\.workspace_id/,
  );
  assert.match(
    hardeningMigration,
    /new\.created_by is distinct from old\.created_by/,
  );
  assert.match(
    hardeningMigration,
    /old\.surface = 'assistant' or new\.surface = 'assistant'/,
  );
  assert.match(
    hardeningMigration,
    /create policy "agents_owner_delete"[\s\S]*archived_at is not null[\s\S]*workspaces\.owner_id/,
  );
  assert.match(
    hardeningMigration,
    /drop policy if exists "agents_delete_combined" on public\.agents/,
  );
});

test("widget tenant identity and public key fields are immutable", () => {
  assert.match(hardeningMigration, /protect_widget_identity_fields/);
  assert.match(
    hardeningMigration,
    /new\.workspace_id is distinct from old\.workspace_id/,
  );
  assert.match(
    hardeningMigration,
    /new\.widget_public_key is distinct from old\.widget_public_key/,
  );
});

test("workspace membership deletion is server-only and owner role is immutable", () => {
  assert.match(hardeningMigration, /protect_workspace_membership_identity/);
  assert.match(
    hardeningMigration,
    /old\.role = 'owner' or new\.role = 'owner'/,
  );
  assert.match(
    hardeningMigration,
    /revoke delete on table public\.workspace_members from anon, authenticated/,
  );
  assert.doesNotMatch(
    hardeningMigration,
    /create policy "workspace_members_admin_delete"/,
  );
});

test("knowledge source creates and updates are server-only", () => {
  assert.match(
    knowledgeWriteContractMigration,
    /revoke insert, update on table public\.knowledge_sources[\s\S]*from anon, authenticated/,
  );
  assert.match(knowledgeWriteContractMigration, /apply only after the application release/i);
  assert.match(
    knowledgeMigration,
    /revoke all on function public\.update_knowledge_source_text[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    knowledgeMigration,
    /grant execute on function public\.update_knowledge_source_text\(uuid, uuid, text\)[\s\S]*to service_role/,
  );
});
