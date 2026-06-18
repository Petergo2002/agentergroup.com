import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeSelectedWebsiteUrls,
  normalizeWebsiteKnowledgeUrl,
} from "../../src/lib/knowledge-website.ts";

const processSource = readFileSync(
  "supabase/functions/process-knowledge-source/index.ts",
  "utf8",
);
const hardeningMigration = readFileSync(
  "supabase/migrations/20260611203002_production_hardening_security_billing_uploads.sql",
  "utf8",
);
const connectionHelperFixMigration = readFileSync(
  "supabase/migrations/20260617210341_fix_replace_agent_connections_helper.sql",
  "utf8",
);
const knowledgeSourcesRoute = readFileSync(
  "src/app/api/knowledge/sources/route.ts",
  "utf8",
);
const assistantServer = readFileSync("src/lib/assistants/server.ts", "utf8");
const builderPage = readFileSync(
  "src/app/(app)/agents/[id]/builder/page.tsx",
  "utf8",
);

test("website knowledge URLs are normalized and restricted to one origin", () => {
  const base = normalizeWebsiteKnowledgeUrl("example.com/docs");
  const selected = normalizeSelectedWebsiteUrls(base, [
    "https://example.com/a",
    "https://example.com/a#section",
    "https://example.com/b",
  ]);

  assert.deepEqual(selected, [
    "https://example.com/a",
    "https://example.com/b",
  ]);
  assert.throws(
    () =>
      normalizeSelectedWebsiteUrls(base, [
        "https://example.com/a",
        "https://evil.example/a",
      ]),
    /website origin/,
  );
});

test("website knowledge page cap is enforced before processing", () => {
  const base = normalizeWebsiteKnowledgeUrl("https://example.com");
  const urls = Array.from(
    { length: 31 },
    (_, index) => `https://example.com/page-${index}`,
  );

  assert.throws(
    () => normalizeSelectedWebsiteUrls(base, urls),
    /maximum of 30/,
  );
});

test("knowledge processing authorizes user-scoped source access before admin mutation", () => {
  const userLookup = processSource.indexOf("const userClient = createClient");
  const userSourceLookup = processSource.indexOf(
    'await userClient\\n      .from("knowledge_sources")'.replace("\\n", "\n"),
  );
  const adminMutation = processSource.indexOf(
    'await adminClient\\n    .from("knowledge_sources")\\n    .update({ status: "processing"'.replaceAll(
      "\\n",
      "\n",
    ),
  );

  assert.ok(userLookup >= 0);
  assert.ok(userSourceLookup > userLookup);
  assert.ok(adminMutation > userSourceLookup);
  assert.match(processSource, /return json\(\{ error: "Missing Authorization header\." \}, 401\)/);
  assert.doesNotMatch(processSource, /source\.metadata\?\.ephemeral.*isInternalRequest/s);
});

test("runtime RLS is read-only for members and assistant threads are owner-private", () => {
  assert.match(
    hardeningMigration,
    /create policy "audit_logs_member_select"[\s\S]*?for select[\s\S]*?private\.is_workspace_member/,
  );
  assert.doesNotMatch(
    hardeningMigration,
    /create policy "audit_logs_member_access"[\s\S]*?for all/,
  );
  assert.match(
    hardeningMigration,
    /create policy "messages_thread_owner_select"[\s\S]*?chat_threads\.created_by = \(select auth\.uid\(\)\)/,
  );
  assert.match(
    hardeningMigration,
    /revoke all on function public\.reserve_knowledge_source_storage[\s\S]*?authenticated/,
  );
  assert.match(
    hardeningMigration,
    /pg_advisory_xact_lock[\s\S]*?widget_session_id is null/,
  );
  assert.match(assistantServer, /\.eq\("created_by", args\.actorUserId\)/);
});

test("knowledge storage reservation distinguishes quota from database failures", () => {
  assert.match(knowledgeSourcesRoute, /function isKnowledgeStorageLimitError/);
  assert.match(knowledgeSourcesRoute, /Failed to reserve knowledge storage\./);
  assert.match(knowledgeSourcesRoute, /status: 500/);
  assert.match(knowledgeSourcesRoute, /deleteKnowledgeSource\(supabase, source\.id\)/);
});

test("builder connection replacement is delegated to one transactional RPC", () => {
  assert.match(builderPage, /\.rpc\(['"]replace_agent_connections['"]/);
  assert.match(
    hardeningMigration,
    /create or replace function public\.replace_agent_connections/,
  );
  assert.match(
    hardeningMigration,
    /delete from public\.agent_connections[\s\S]*?insert into public\.agent_connections/,
  );
  assert.match(
    connectionHelperFixMigration,
    /if not private\.can_edit_agent\(p_agent_id\)/,
  );
  assert.doesNotMatch(
    connectionHelperFixMigration,
    /if not public\.can_edit_agent\(p_agent_id\)/,
  );
});
