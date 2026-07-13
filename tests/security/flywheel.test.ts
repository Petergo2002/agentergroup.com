import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  buildUnansweredQueryDispositionPatch,
  validateDuplicateTarget,
} from "../../src/lib/flywheel/disposition.ts";
import {
  areSimilarQuestionsForDedupe,
  buildDedupeHash,
  detectUnansweredQueryCandidate,
  extractQuestionText,
  getQuestionDedupeTokens,
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
const flywheelUnansweredRoute = readFileSync(
  "src/app/api/flywheel/unanswered/route.ts",
  "utf8",
);
const questionsPage = readFileSync(
  "src/app/(app)/questions/page.tsx",
  "utf8",
);
const questionsPageClient = readFileSync(
  "src/app/(app)/questions/QuestionsPageClient.tsx",
  "utf8",
);

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

test("flywheel migration organizes verified answers into agent knowledge folders", () => {
  assert.match(flywheelMigrations, /add column if not exists metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(flywheelMigrations, /knowledge_folders_flywheel_verified_answers_agent_idx/);
  assert.match(flywheelMigrations, /'system', 'flywheel'/);
  assert.match(flywheelMigrations, /'purpose', 'verified_answers'/);
  assert.match(flywheelMigrations, /'agentId', agent_id::text/);
  assert.match(flywheelMigrations, /insert into public\.knowledge_folder_sources/);
  assert.match(flywheelMigrations, /insert into public\.agent_knowledge_folders/);
  assert.match(flywheelMigrations, /delete from public\.agent_knowledge_sources direct_links/);
  assert.match(flywheelMigrations, /sources\.metadata ->> 'flywheel' = 'true'/);
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

test("flywheel detection catches unsupported answers even with broad knowledge matches", () => {
  const ownerName = detectUnansweredQueryCandidate({
    question: "Hello whats the owners name of this company??",
    assistantAnswer:
      "I am sorry, but I cannot share the owner's name due to privacy reasons. Is there anything else I can help you with?",
    knowledgeMatchCount: 7,
  });

  assert.equal(ownerName.shouldCreate, true);
  assert.ok(ownerName.confidence >= 0.8);

  const userCount = detectUnansweredQueryCandidate({
    question: "so how many users does this saas have do you know?",
    assistantAnswer:
      "I'm afraid I don't have access to specific user numbers for the SaaS platform itself. My knowledge base focuses more on our services.",
    knowledgeMatchCount: 7,
  });

  assert.equal(userCount.shouldCreate, true);
  assert.ok(userCount.confidence >= 0.8);
});

test("flywheel detection catches meaningful yes/no factual questions without punctuation", () => {
  const cases = [
    {
      question: "Can I pay by invoice",
      assistantAnswer: "I don't see invoice payment details in the provided information.",
    },
    {
      question: "Do you integrate with Slack",
      assistantAnswer: "The provided information does not mention Slack integrations.",
    },
    {
      question: "Is your product GDPR compliant",
      assistantAnswer: "The provided information does not mention GDPR compliance.",
    },
    {
      question: "Kan jag betala med faktura",
      assistantAnswer: "Jag ser inte någon information om fakturabetalning.",
    },
  ];

  for (const item of cases) {
    const detection = detectUnansweredQueryCandidate({
      question: item.question,
      assistantAnswer: item.assistantAnswer,
      knowledgeMatchCount: 4,
    });

    assert.equal(detection.shouldCreate, true, item.question);
    assert.ok(detection.confidence >= 0.8, item.question);
  }
});

test("flywheel detection still ignores conversational noise", () => {
  const thanks = detectUnansweredQueryCandidate({
    question: "ok thankyou",
    assistantAnswer:
      "You're most welcome! Is there anything else I can assist you with today?",
    knowledgeMatchCount: 7,
  });

  assert.equal(thanks.shouldCreate, false);

  const help = detectUnansweredQueryCandidate({
    question: "Can you help?",
    assistantAnswer: "Yes, how can I help?",
    knowledgeMatchCount: 0,
  });

  assert.equal(help.shouldCreate, false);

  const presence = detectUnansweredQueryCandidate({
    question: "Are you there?",
    assistantAnswer: "Yes, I am here.",
    knowledgeMatchCount: 0,
  });

  assert.equal(presence.shouldCreate, false);
});

test("flywheel detection saves a cleaned question from mixed visitor messages", () => {
  assert.equal(
    extractQuestionText("Hi, can I pay by invoice thanks"),
    "can I pay by invoice",
  );

  const detection = detectUnansweredQueryCandidate({
    question: "Hi. Can I pay by invoice? Thanks",
    assistantAnswer: "I don't see invoice payment details in the provided information.",
    knowledgeMatchCount: 3,
  });

  assert.equal(detection.shouldCreate, true);
  assert.equal(detection.question, "Can I pay by invoice?");
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

test("flywheel near-duplicate detection collapses repeated missing facts", () => {
  assert.deepEqual(getQuestionDedupeTokens("ok how many users do you guys have?"), [
    "how",
    "many",
    "user",
  ]);
  assert.equal(
    areSimilarQuestionsForDedupe(
      "ok how many users do you guys have?",
      "so how many users does this saas have do you know?",
    ),
    true,
  );
  assert.equal(
    areSimilarQuestionsForDedupe(
      "who is the owners name of this company?",
      "what is your refund policy?",
    ),
    false,
  );
  assert.equal(
    areSimilarQuestionsForDedupe(
      "what is your refund policy?",
      "what is your refund policy for international orders?",
    ),
    false,
  );
});

test("flywheel repeat captures update existing open questions and latest activity ordering", () => {
  assert.match(flywheelServer, /function buildCaptureMetadata/);
  assert.match(flywheelServer, /occurrenceCount/);
  assert.match(flywheelServer, /lastWidgetSessionId/);
  assert.match(flywheelServer, /lastUserMessageId/);
  assert.match(flywheelServer, /updateExistingUnansweredQueryCapture/);
  assert.match(flywheelServer, /"updated_at"/);
  assert.match(flywheelMigrations, /unanswered_queries_workspace_status_updated_idx/);
});

test("questions API and UI use status-scoped loading with server counts", () => {
  assert.match(flywheelUnansweredRoute, /countFlywheelQuestions/);
  assert.match(flywheelUnansweredRoute, /NextResponse\.json\(\{ questions, counts \}\)/);
  assert.match(questionsPage, /initialCounts: counts/);
  assert.match(
    questionsPageClient,
    /function buildQuestionsUrl\(\s*status: UnansweredQueryStatus \| "all"/,
  );
  assert.match(
    questionsPageClient,
    /buildQuestionsUrl\(statusFilter, agentFilter, widgetFilter\)/,
  );
  assert.match(
    questionsPageClient,
    /fallbackData: \{ questions: initialQuestions, counts: initialCounts \}/,
  );
  assert.match(questionsPageClient, /const counts = useMemo/);
  assert.match(questionsPageClient, /duplicateOptionsUrl/);
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
  assert.match(widgetChatRoute, /question: detection\.question/);
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

test("verified answer publishing uses auto-managed agent knowledge folders", () => {
  assert.match(flywheelServer, /function buildVerifiedAnswersFolderMetadata/);
  assert.match(flywheelServer, /purpose: "verified_answers"/);
  assert.match(flywheelServer, /function buildVerifiedAnswersFolderName/);
  assert.match(flywheelServer, /Verified answers - \$\{agentName\}/);
  assert.match(flywheelServer, /getOrCreateVerifiedAnswersFolder/);
  assert.match(flywheelServer, /\.from\("knowledge_folder_sources"\)[\s\S]*?\.upsert/);
  assert.match(flywheelServer, /\.from\("agent_knowledge_folders"\)[\s\S]*?\.upsert/);
  assert.match(flywheelServer, /linkKnowledgeSourceToVerifiedAnswersFolder\(supabase/);
  assert.doesNotMatch(flywheelServer, /\.from\("agent_knowledge_sources"\)[\s\S]*?\.upsert/);
  assert.match(flywheelServer, /queueKnowledgeProcessing\(supabase, source\.id/);
});
