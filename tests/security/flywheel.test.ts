import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  buildUnansweredQueryDispositionPatch,
  validateDuplicateTarget,
} from "../../src/lib/flywheel/disposition.ts";
import {
  buildDedupeHash,
  detectUnansweredQueryCandidate,
} from "../../src/lib/flywheel/detection.ts";

const migration = readFileSync(
  "supabase/migrations/20260701165220_data_flywheel.sql",
  "utf8",
);
const flywheelMigrations = readdirSync("supabase/migrations")
  .filter((fileName) => fileName.endsWith(".sql") && fileName.includes("flywheel"))
  .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, "utf8"))
  .join("\n");
const widgetChatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const flywheelServer = readFileSync("src/lib/flywheel/server.ts", "utf8");

test("flywheel migration creates scoped RLS tables without anonymous access", () => {
  assert.match(migration, /create table if not exists public\.unanswered_queries/);
  assert.match(migration, /create table if not exists public\.verified_facts/);
  assert.match(migration, /alter table public\.unanswered_queries enable row level security/);
  assert.match(migration, /alter table public\.verified_facts enable row level security/);
  assert.match(migration, /revoke all on table public\.unanswered_queries from anon/);
  assert.match(migration, /revoke all on table public\.verified_facts from anon/);
  assert.match(migration, /private\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /private\.can_edit_agent\(agent_id\)/);
  assert.doesNotMatch(migration, /grant .* on table public\.(?:unanswered_queries|verified_facts) to anon/);
});

test("flywheel migration dedupes open questions and indexes operational lookups", () => {
  assert.match(
    migration,
    /create unique index if not exists unanswered_queries_open_dedupe_idx[\s\S]*where status = 'open' and duplicate_of is null/,
  );
  assert.match(migration, /unanswered_queries_workspace_status_created_idx/);
  assert.match(migration, /unanswered_queries_agent_status_idx/);
  assert.match(migration, /unanswered_queries_widget_session_idx/);
  assert.match(migration, /verified_facts_workspace_status_created_idx/);
  assert.match(migration, /verified_facts_knowledge_source_idx/);
});

test("flywheel migrations cover foreign key advisor indexes", () => {
  assert.match(flywheelMigrations, /unanswered_queries_widget_id_idx/);
  assert.match(flywheelMigrations, /unanswered_queries_widget_agent_id_idx/);
  assert.match(flywheelMigrations, /unanswered_queries_user_message_id_idx/);
  assert.match(flywheelMigrations, /unanswered_queries_assistant_message_id_idx/);
  assert.match(flywheelMigrations, /verified_facts_created_by_idx/);
});

test("flywheel detection creates conservative candidates for factual misses", () => {
  const fallback = detectUnansweredQueryCandidate({
    question: "What is your refund policy?",
    assistantAnswer: "Sorry, I don't have enough information to answer that.",
    knowledgeMatchCount: 0,
  });

  assert.equal(fallback.shouldCreate, true);
  assert.ok(fallback.confidence >= 0.8);

  const nonQuestion = detectUnansweredQueryCandidate({
    question: "hello",
    assistantAnswer: "Hi, how can I help?",
    knowledgeMatchCount: 0,
  });

  assert.equal(nonQuestion.shouldCreate, false);
});

test("flywheel detection catches Swedish fallback answers", () => {
  const fallback = detectUnansweredQueryCandidate({
    question: "Vad kostar installationen?",
    assistantAnswer: "Jag är inte säker, kontakta oss så hjälper vi dig.",
    knowledgeMatchCount: 1,
  });

  assert.equal(fallback.shouldCreate, true);
  assert.ok(fallback.confidence >= 0.7);
});

test("flywheel dedupe hash is normalized per agent", () => {
  assert.equal(
    buildDedupeHash("agent-a", "What is your refund policy?"),
    buildDedupeHash("agent-a", " what is your refund policy "),
  );
  assert.notEqual(
    buildDedupeHash("agent-a", "What is your refund policy?"),
    buildDedupeHash("agent-b", "What is your refund policy?"),
  );
});

test("widget chat creates flywheel candidates only after assistant persistence and never for preview", () => {
  const assistantPersistIndex = widgetChatRoute.indexOf(
    "const persistedMessages = await insertWidgetMessages",
  );
  const successCaptureIndex = widgetChatRoute.indexOf(
    "scheduleFlywheelCapture({",
    assistantPersistIndex,
  );
  const createCandidateIndex = widgetChatRoute.indexOf(
    "createUnansweredQueryCandidate",
  );

  assert.ok(assistantPersistIndex >= 0);
  assert.ok(successCaptureIndex > assistantPersistIndex);
  assert.ok(createCandidateIndex >= 0);
  assert.match(widgetChatRoute, /if \(access\.source === "preview"\)/);
  assert.match(widgetChatRoute, /userMessageId/);
  assert.match(widgetChatRoute, /assistantMessageId/);
});

test("widget chat creates flywheel candidates for hard stream failures", () => {
  const streamFailureIndex = widgetChatRoute.indexOf("widget_chat_stream_failed");
  const failureCaptureIndex = widgetChatRoute.indexOf(
    "The widget runtime failed before producing an answer.",
    streamFailureIndex,
  );

  assert.ok(streamFailureIndex >= 0);
  assert.ok(failureCaptureIndex > streamFailureIndex);
  assert.match(widgetChatRoute, /runtimeHadError: true/);
  assert.match(widgetChatRoute, /assistantMessageId: null/);
});

test("question disposition blocks verified and answered state rewrites", () => {
  assert.throws(
    () =>
      buildUnansweredQueryDispositionPatch({
        action: "reopen",
        currentStatus: "answered",
        hasVerifiedFact: true,
        questionId: "question-1",
        resolvedAt: "2026-07-02T00:00:00.000Z",
      }),
    /verified answer/,
  );

  assert.throws(
    () =>
      buildUnansweredQueryDispositionPatch({
        action: "dismiss",
        currentStatus: "dismissed",
        hasVerifiedFact: false,
        questionId: "question-1",
        resolvedAt: "2026-07-02T00:00:00.000Z",
      }),
    /Only open questions/,
  );

  assert.deepEqual(
    buildUnansweredQueryDispositionPatch({
      action: "mark_duplicate",
      currentStatus: "open",
      hasVerifiedFact: false,
      questionId: "question-1",
      duplicateOf: "question-2",
      resolvedAt: "2026-07-02T00:00:00.000Z",
    }),
    {
      status: "duplicate",
      duplicate_of: "question-2",
      resolved_at: "2026-07-02T00:00:00.000Z",
    },
  );

  assert.throws(
    () =>
      validateDuplicateTarget({
        original: {
          id: "question-2",
          agentId: "agent-1",
          status: "dismissed",
        },
        currentAgentId: "agent-1",
      }),
    /open or answered/,
  );
});

test("verified answer publishing preserves existing agent knowledge attachments", () => {
  assert.match(flywheelServer, /\.from\("agent_knowledge_sources"\)[\s\S]*?\.upsert/);
  assert.doesNotMatch(
    flywheelServer,
    /\.from\("agent_knowledge_sources"\)[\s\S]*?\.delete\(\)[\s\S]*?publishVerifiedAnswer/,
  );
  assert.match(flywheelServer, /queueKnowledgeProcessing\(supabase, source\.id/);
});
