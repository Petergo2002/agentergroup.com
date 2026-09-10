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
  "src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx",
  "utf8",
);
const transactionalSaveMigration = readFileSync(
  "supabase/migrations/20260910140100_transactional_agent_save_publish.sql",
  "utf8",
);
const versionScopedSearchMigration = readFileSync(
  "supabase/migrations/20260910140000_agent_version_scoped_knowledge_search.sql",
  "utf8",
);
const agentChatRuntime = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");
const publicWidgetChatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const searchKnowledgeFunction = readFileSync(
  "supabase/functions/search-knowledge/index.ts",
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
  const adminMutation = processSource.indexOf('adminClient.rpc("claim_knowledge_processing"');

  assert.ok(userLookup >= 0);
  assert.ok(userSourceLookup > userLookup);
  assert.ok(adminMutation > userSourceLookup);
  assert.match(processSource, /return json\(\{ error: "Missing Authorization header\." \}, 401\)/);
  assert.doesNotMatch(processSource, /source\.metadata\?\.ephemeral[\s\S]*isInternalRequest/);
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

test("builder save/publish is delegated to transactional RPCs", () => {
  assert.match(builderPage, /\.rpc\(\s*['"]save_agent_draft_v1['"]/);
  assert.match(builderPage, /\.rpc\(\s*['"]publish_agent_version_v1['"]/);
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
  // save_agent_draft_v1 must replace connections/knowledge in the SAME
  // transaction as the agents/agent_drafts writes, not as separate calls.
  assert.match(
    transactionalSaveMigration,
    /create or replace function public\.save_agent_draft_v1/,
  );
  assert.match(
    transactionalSaveMigration,
    /perform public\.replace_agent_connections\(p_agent_id, p_connection_ids\)/,
  );
  assert.match(
    transactionalSaveMigration,
    /create or replace function public\.replace_agent_knowledge_v1/,
  );
  assert.match(
    transactionalSaveMigration,
    /perform public\.replace_agent_knowledge_v1\(p_agent_id, p_knowledge_source_ids, p_knowledge_folder_ids\)/,
  );
  // Both save and publish must reject a caller working from a stale snapshot
  // instead of silently overwriting a concurrent editor's changes.
  assert.match(
    transactionalSaveMigration,
    /if agent_record\.updated_at is distinct from p_expected_agent_updated_at then\s*\n\s*raise exception 'AGENT_SAVE_CONFLICT' using errcode = '40001';/,
  );
  assert.match(
    transactionalSaveMigration,
    /create or replace function public\.publish_agent_version_v1/,
  );
  assert.match(
    transactionalSaveMigration,
    /raise exception 'AGENT_PUBLISH_CONFLICT' using errcode = '40001';/,
  );
});

test("public widget chat scopes tools and knowledge to the published version, not the live draft", () => {
  // The public chat route must hand the published version's definition to the
  // runtime so it never trusts an unpublished draft's connections/knowledge.
  assert.match(
    publicWidgetChatRoute,
    /publishedDefinition:\s*publishedVersion\?\.definition/,
  );

  // loadRuntimeContext must branch on a supplied publishedDefinition and
  // derive tool connections/knowledge ids from it instead of the live
  // agent_connections/agent_knowledge_sources/agent_knowledge_folders tables.
  assert.match(agentChatRuntime, /if \(publishedDefinition\) \{/);
  assert.match(agentChatRuntime, /getKnowledgeSourceIdsFromDefinition\(publishedDefinition\)/);
  assert.match(agentChatRuntime, /getKnowledgeFolderIdsFromDefinition\(publishedDefinition\)/);
  assert.match(agentChatRuntime, /getToolConnectionsFromDefinition\(publishedDefinition\)/);

  // The live-table fallback must remain for surfaces that intentionally run
  // against the current draft (e.g. Builder preview/test chat).
  assert.match(agentChatRuntime, /from\("agent_connections"\)/);
  assert.match(agentChatRuntime, /from\("agent_knowledge_sources"\)/);
  assert.match(agentChatRuntime, /from\("agent_knowledge_folders"\)/);

  // search-knowledge must call the version-scoped RPC when given explicit
  // source/folder ids, not the agent-id-joined default function.
  assert.match(searchKnowledgeFunction, /match_agent_knowledge_chunks_scoped/);
  assert.match(searchKnowledgeFunction, /isScopedRequest/);

  // The scoped SQL function must restrict eligible sources to the given id
  // arrays instead of joining agent_knowledge_sources/agent_knowledge_folders
  // by agent_id (which would still leak live draft attachments).
  assert.match(
    versionScopedSearchMigration,
    /create or replace function public\.match_agent_knowledge_chunks_scoped/,
  );
  assert.match(
    versionScopedSearchMigration,
    /sources\.id = any \(coalesce\(input_source_ids, '\{\}'::uuid\[\]\)\)/,
  );
  assert.doesNotMatch(
    versionScopedSearchMigration,
    /public\.agent_knowledge_sources/,
  );
});
