import { Buffer } from "node:buffer";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canEditAgentRecord } from "@/lib/agents/access";
import {
  buildUnansweredQueryDispositionPatch,
  InvalidQuestionDispositionError,
  validateDuplicateTarget,
} from "@/lib/flywheel/disposition";
import {
  areSimilarQuestionsForDedupe,
  buildDedupeHash,
  clampConfidence,
  truncate,
} from "@/lib/flywheel/detection";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AgentRecord,
  FlywheelQuestionCounts,
  FlywheelQuestionDetail,
  FlywheelQuestionListItem,
  KnowledgeFolderRecord,
  KnowledgeSourceRecord,
  KnowledgeSourceStatus,
  UnansweredQueryRecord,
  VerifiedFactRecord,
  UnansweredQueryStatus,
  VerifiedFactVisibility,
  WorkspaceMemberRecord,
} from "@/lib/types";

export {
  buildConversationExcerpt,
  buildDedupeHash,
  detectUnansweredQueryCandidate,
} from "@/lib/flywheel/detection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = SupabaseClient<any>;

export class FlywheelError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "FlywheelError";
    this.status = status;
  }
}

interface CreateCandidateInput {
  workspaceId: string;
  widgetId: string;
  widgetAgentId: string | null;
  agentId: string;
  widgetSessionId: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  question: string;
  assistantAnswer: string;
  contextExcerpt?: string;
  detectionReason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

interface PublishVerifiedAnswerInput {
  workspaceId: string;
  userId: string;
  membershipRole: WorkspaceMemberRecord["role"];
  queryId: string;
  answer: string;
  visibility?: VerifiedFactVisibility;
  accessToken?: string | null;
}

interface RetryKnowledgeProcessingInput {
  workspaceId: string;
  userId: string;
  membershipRole: WorkspaceMemberRecord["role"];
  verifiedFactId: string;
  accessToken?: string | null;
}

interface UpdateVerifiedFactInput {
  workspaceId: string;
  userId: string;
  membershipRole: WorkspaceMemberRecord["role"];
  verifiedFactId: string;
  answer: string;
  visibility?: VerifiedFactVisibility;
  accessToken?: string | null;
}

interface UpdateQuestionDispositionInput {
  workspaceId: string;
  userId: string;
  membershipRole: WorkspaceMemberRecord["role"];
  queryId: string;
  action: "dismiss" | "reopen" | "mark_duplicate";
  duplicateOf?: string | null;
}

interface ListQuestionsInput {
  workspaceId: string;
  status?: UnansweredQueryStatus | "all";
  agentId?: string | null;
  widgetId?: string | null;
  limit?: number;
}

interface CountQuestionsInput {
  workspaceId: string;
  agentId?: string | null;
  widgetId?: string | null;
}

interface AgentLookupRow {
  id: string;
  name: string;
}

interface WidgetLookupRow {
  id: string;
  name: string;
}

interface ConversationSummaryLookupRow {
  widget_session_id: string;
  session_id: string;
  page_url: string | null;
  referrer: string | null;
  last_activity_at: string | null;
}

interface KnowledgeSourceLookupRow {
  id: string;
  status: KnowledgeSourceStatus;
  error_message: string | null;
}

interface ConversationMessageLookupRow {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

const QUESTION_STATUSES: UnansweredQueryStatus[] = [
  "open",
  "answered",
  "dismissed",
  "duplicate",
];
const VERIFIED_ANSWERS_FOLDER_DESCRIPTION =
  "Auto-managed verified answers from the Questions queue.";

function buildVerifiedAnswersFolderMetadata(agentId: string) {
  return {
    system: "flywheel",
    purpose: "verified_answers",
    agentId,
  };
}

function buildVerifiedAnswersFolderName(agentName: string, agentId: string, includeSuffix = false) {
  const baseName = truncate(`Verified answers - ${agentName}`, 180);

  if (!includeSuffix) {
    return baseName;
  }

  return truncate(`${baseName} (${agentId.slice(0, 8)})`, 220);
}

function metadataNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildCaptureMetadata(
  row: UnansweredQueryRecord | null,
  input: CreateCandidateInput,
) {
  const capturedAt = new Date().toISOString();
  const previousMetadata = row?.metadata ?? {};
  const occurrenceCount = row
    ? metadataNumber(previousMetadata.occurrenceCount, 1) + 1
    : 1;

  return {
    ...previousMetadata,
    ...(input.metadata ?? {}),
    occurrenceCount,
    lastCapturedAt: capturedAt,
    lastWidgetSessionId: input.widgetSessionId,
    lastUserMessageId: input.userMessageId,
    lastAssistantMessageId: input.assistantMessageId,
    lastDetectionReason: input.detectionReason,
    lastConfidence: clampConfidence(input.confidence),
  };
}

async function hydrateFlywheelQuestions(
  supabase: SupabaseAny,
  rows: UnansweredQueryRecord[],
): Promise<FlywheelQuestionListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const agentIds = uniqueValues(rows.map((row) => row.agent_id));
  const widgetIds = uniqueValues(rows.map((row) => row.widget_id));
  const widgetSessionIds = uniqueValues(rows.map((row) => row.widget_session_id));
  const queryIds = rows.map((row) => row.id);

  const [agentsResult, widgetsResult, summariesResult, factsResult] =
    await Promise.all([
      agentIds.length
        ? supabase.from("agents").select("id, name").in("id", agentIds)
        : Promise.resolve({ data: [], error: null }),
      widgetIds.length
        ? supabase.from("widgets").select("id, name").in("id", widgetIds)
        : Promise.resolve({ data: [], error: null }),
      widgetSessionIds.length
        ? supabase
            .from("dashboard_conversation_summaries")
            .select("widget_session_id, session_id, page_url, referrer, last_activity_at")
            .in("widget_session_id", widgetSessionIds)
        : Promise.resolve({ data: [], error: null }),
      queryIds.length
        ? supabase
            .from("verified_facts")
            .select("*")
            .in("unanswered_query_id", queryIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [agentsResult, widgetsResult, summariesResult, factsResult]) {
    if (result.error) {
      throw new FlywheelError(result.error.message);
    }
  }

  const agentsById = new Map(
    ((agentsResult.data ?? []) as AgentLookupRow[]).map((agent) => [agent.id, agent]),
  );
  const widgetsById = new Map(
    ((widgetsResult.data ?? []) as WidgetLookupRow[]).map((widget) => [widget.id, widget]),
  );
  const summariesBySessionId = new Map(
    ((summariesResult.data ?? []) as ConversationSummaryLookupRow[]).map((summary) => [
      summary.widget_session_id,
      summary,
    ]),
  );
  const factByQueryId = new Map<string, VerifiedFactRecord>();

  for (const fact of (factsResult.data ?? []) as VerifiedFactRecord[]) {
    if (fact.unanswered_query_id && !factByQueryId.has(fact.unanswered_query_id)) {
      factByQueryId.set(fact.unanswered_query_id, fact);
    }
  }

  const sourceIds = uniqueValues(
    Array.from(factByQueryId.values()).map((fact) => fact.knowledge_source_id),
  );
  const sourcesResult = sourceIds.length
    ? await supabase
        .from("knowledge_sources")
        .select("id, status, error_message")
        .in("id", sourceIds)
    : { data: [], error: null };

  if (sourcesResult.error) {
    throw new FlywheelError(sourcesResult.error.message);
  }

  const sourcesById = new Map(
    ((sourcesResult.data ?? []) as KnowledgeSourceLookupRow[]).map((source) => [
      source.id,
      source,
    ]),
  );

  return rows.map((row) => {
    const fact = factByQueryId.get(row.id) ?? null;
    const source = fact?.knowledge_source_id
      ? sourcesById.get(fact.knowledge_source_id) ?? null
      : null;
    const summary = summariesBySessionId.get(row.widget_session_id) ?? null;

    return {
      ...row,
      agent_name: agentsById.get(row.agent_id)?.name ?? null,
      widget_name: widgetsById.get(row.widget_id)?.name ?? null,
      widget_session_public_id: summary?.session_id ?? null,
      page_url: summary?.page_url ?? null,
      referrer: summary?.referrer ?? null,
      last_activity_at: summary?.last_activity_at ?? null,
      verified_fact: fact,
      knowledge_source_status: source?.status ?? null,
      knowledge_source_error: source?.error_message ?? null,
    };
  });
}

export async function listFlywheelQuestions(
  supabase: SupabaseAny,
  input: ListQuestionsInput,
) {
  const requestedLimit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? input.limit
      : 100;
  const limit = Math.min(Math.max(requestedLimit, 1), 200);
  const orderByLatestActivity =
    !input.status || input.status === "open" || input.status === "all";
  let query = supabase
    .from("unanswered_queries")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .order(orderByLatestActivity ? "updated_at" : "created_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  } else if (!input.status) {
    query = query.eq("status", "open");
  }

  if (input.agentId) {
    query = query.eq("agent_id", input.agentId);
  }

  if (input.widgetId) {
    query = query.eq("widget_id", input.widgetId);
  }

  const { data, error } = await query;

  if (error) {
    throw new FlywheelError(error.message);
  }

  return hydrateFlywheelQuestions(supabase, (data ?? []) as UnansweredQueryRecord[]);
}

export async function countFlywheelQuestions(
  supabase: SupabaseAny,
  input: CountQuestionsInput,
): Promise<FlywheelQuestionCounts> {
  const statusCounts = await Promise.all(
    QUESTION_STATUSES.map(async (status) => {
      let query = supabase
        .from("unanswered_queries")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("status", status);

      if (input.agentId) {
        query = query.eq("agent_id", input.agentId);
      }

      if (input.widgetId) {
        query = query.eq("widget_id", input.widgetId);
      }

      const { count, error } = await query;

      if (error) {
        throw new FlywheelError(error.message);
      }

      return [status, count ?? 0] as const;
    }),
  );
  const counts = Object.fromEntries(statusCounts) as Record<UnansweredQueryStatus, number>;

  return {
    total: QUESTION_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    open: counts.open,
    answered: counts.answered,
    dismissed: counts.dismissed,
    duplicate: counts.duplicate,
  };
}

export async function getFlywheelQuestionDetail(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    queryId: string;
  },
): Promise<FlywheelQuestionDetail> {
  const { data, error } = await supabase
    .from("unanswered_queries")
    .select("*")
    .eq("id", input.queryId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  if (!data) {
    throw new FlywheelError("Question not found.", 404);
  }

  const hydrated = await hydrateFlywheelQuestions(supabase, [
    data as UnansweredQueryRecord,
  ]);
  const question = hydrated[0];

  if (!question) {
    throw new FlywheelError("Question not found.", 404);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("widget_session_messages")
    .select("id, role, content, created_at")
    .eq("widget_session_id", question.widget_session_id)
    .order("created_at", { ascending: true })
    .limit(40);

  if (messagesError) {
    throw new FlywheelError(messagesError.message);
  }

  return {
    ...question,
    conversation_messages: (messages ?? []) as ConversationMessageLookupRow[],
  };
}

export async function dedupeUnansweredQuery(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    dedupeHash: string;
  },
) {
  const { data, error } = await supabase
    .from("unanswered_queries")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("agent_id", input.agentId)
    .eq("dedupe_hash", input.dedupeHash)
    .eq("status", "open")
    .is("duplicate_of", null)
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  return (data ?? null) as UnansweredQueryRecord | null;
}

async function findSimilarOpenUnansweredQuery(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    question: string;
  },
) {
  const { data, error } = await supabase
    .from("unanswered_queries")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("agent_id", input.agentId)
    .eq("status", "open")
    .is("duplicate_of", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new FlywheelError(error.message);
  }

  return (
    ((data ?? []) as UnansweredQueryRecord[]).find((row) =>
      areSimilarQuestionsForDedupe(row.question, input.question),
    ) ?? null
  );
}

async function updateExistingUnansweredQueryCapture(
  supabase: SupabaseAny,
  row: UnansweredQueryRecord,
  input: CreateCandidateInput,
) {
  const assistantAnswer = truncate(input.assistantAnswer, 3000);
  const { data, error } = await supabase
    .from("unanswered_queries")
    .update({
      widget_id: input.widgetId,
      widget_agent_id: input.widgetAgentId,
      widget_session_id: input.widgetSessionId,
      user_message_id: input.userMessageId,
      assistant_message_id: input.assistantMessageId,
      assistant_answer: assistantAnswer,
      context_excerpt: truncate(input.contextExcerpt ?? "", 1600),
      detection_reason: truncate(input.detectionReason, 400),
      confidence: Math.max(row.confidence, clampConfidence(input.confidence)),
      metadata: buildCaptureMetadata(row, input),
    })
    .eq("id", row.id)
    .select()
    .single();

  if (error || !data) {
    throw new FlywheelError(error?.message ?? "Failed to update existing question.");
  }

  return data as UnansweredQueryRecord;
}

export async function createUnansweredQueryCandidate(
  supabase: SupabaseAny,
  input: CreateCandidateInput,
) {
  const question = truncate(input.question, 1200);
  const assistantAnswer = truncate(input.assistantAnswer, 3000);
  const dedupeHash = buildDedupeHash(input.agentId, question);
  const existing = await dedupeUnansweredQuery(supabase, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    dedupeHash,
  });

  if (existing) {
    const updated = await updateExistingUnansweredQueryCapture(
      supabase,
      existing,
      input,
    );
    return { query: updated, created: false };
  }

  const similarExisting = await findSimilarOpenUnansweredQuery(supabase, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    question,
  });

  if (similarExisting) {
    const updated = await updateExistingUnansweredQueryCapture(
      supabase,
      similarExisting,
      input,
    );
    return { query: updated, created: false };
  }

  const { data, error } = await supabase
    .from("unanswered_queries")
    .insert({
      workspace_id: input.workspaceId,
      widget_id: input.widgetId,
      widget_agent_id: input.widgetAgentId,
      agent_id: input.agentId,
      widget_session_id: input.widgetSessionId,
      user_message_id: input.userMessageId,
      assistant_message_id: input.assistantMessageId,
      question,
      assistant_answer: assistantAnswer,
      context_excerpt: truncate(input.contextExcerpt ?? "", 1600),
      detection_reason: truncate(input.detectionReason, 400),
      confidence: clampConfidence(input.confidence),
      dedupe_hash: dedupeHash,
      metadata: buildCaptureMetadata(null, input),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const query = await dedupeUnansweredQuery(supabase, {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        dedupeHash,
      });

      if (query) {
        const updated = await updateExistingUnansweredQueryCapture(
          supabase,
          query,
          input,
        );
        return { query: updated, created: false };
      }
    }

    throw new FlywheelError(error.message);
  }

  return { query: data as UnansweredQueryRecord, created: true };
}

async function loadAgentForEdit(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    userId: string;
    membershipRole: WorkspaceMemberRecord["role"];
  },
) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, workspace_id, created_by, name, surface")
    .eq("id", input.agentId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  if (!data) {
    throw new FlywheelError("Agent not found.", 404);
  }

  if (!canEditAgentRecord(data as AgentRecord, input.userId, input.membershipRole)) {
    throw new FlywheelError("You do not have permission to edit this agent.", 403);
  }

  return data as Pick<AgentRecord, "id" | "workspace_id" | "created_by" | "name" | "surface">;
}

function buildVerifiedKnowledgeText(question: string, answer: string) {
  return [`Question: ${question.trim()}`, `Verified answer: ${answer.trim()}`].join("\n\n");
}

async function reserveKnowledgeStorage(
  workspaceId: string,
  sourceId: string,
  sizeBytes: number,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("reserve_knowledge_source_storage", {
    p_workspace_id: workspaceId,
    p_source_id: sourceId,
    p_size_bytes: sizeBytes,
  });

  if (error) {
    throw new FlywheelError(
      error.message.includes("KNOWLEDGE_STORAGE_LIMIT_EXCEEDED")
        ? "Storage limit exceeded for this workspace."
        : error.message,
      error.message.includes("KNOWLEDGE_STORAGE_LIMIT_EXCEEDED") ? 402 : 500,
    );
  }
}

async function updateKnowledgeSourceText(
  workspaceId: string,
  sourceId: string,
  rawText: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_knowledge_source_text", {
    p_workspace_id: workspaceId,
    p_source_id: sourceId,
    p_raw_text: rawText,
  });

  if (error) {
    const isStorageLimit = error.message.includes(
      "KNOWLEDGE_STORAGE_LIMIT_EXCEEDED",
    );
    const isBusy = error.message.includes("KNOWLEDGE_SOURCE_BUSY");

    throw new FlywheelError(
      isStorageLimit
        ? "Storage limit exceeded for this workspace."
        : isBusy
          ? "This knowledge source is already being processed."
          : "Failed to update the verified knowledge source.",
      isStorageLimit ? 402 : isBusy ? 409 : 500,
    );
  }
}

async function deleteKnowledgeSource(supabase: SupabaseAny, sourceId: string) {
  const { error } = await supabase
    .from("knowledge_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    console.error("[flywheel] Failed to clean up knowledge source.", {
      sourceId,
      error: error.message,
    });
  }
}

async function findVerifiedAnswersFolder(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
  },
) {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .contains("metadata", buildVerifiedAnswersFolderMetadata(input.agentId))
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  return (data ?? null) as KnowledgeFolderRecord | null;
}

async function createVerifiedAnswersFolder(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    agentName: string;
    userId: string;
  },
) {
  const baseName = buildVerifiedAnswersFolderName(input.agentName, input.agentId);
  const { data: nameCollision, error: collisionError } = await supabase
    .from("knowledge_folders")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("name", baseName)
    .maybeSingle();

  if (collisionError) {
    throw new FlywheelError(collisionError.message);
  }

  const folderName = nameCollision
    ? buildVerifiedAnswersFolderName(input.agentName, input.agentId, true)
    : baseName;
  const { data, error } = await supabase
    .from("knowledge_folders")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: folderName,
      description: VERIFIED_ANSWERS_FOLDER_DESCRIPTION,
      metadata: buildVerifiedAnswersFolderMetadata(input.agentId),
    })
    .select("*")
    .single();

  if (!error && data) {
    return data as KnowledgeFolderRecord;
  }

  if (error?.code === "23505") {
    const existing = await findVerifiedAnswersFolder(supabase, input);

    if (existing) {
      return existing;
    }
  }

  throw new FlywheelError(error?.message ?? "Failed to create verified answers folder.");
}

export async function getOrCreateVerifiedAnswersFolder(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    agentName: string;
    userId: string;
  },
) {
  const existing = await findVerifiedAnswersFolder(supabase, input);

  if (existing) {
    return existing;
  }

  return createVerifiedAnswersFolder(supabase, input);
}

export async function createKnowledgeSourceFromVerifiedFact(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    userId: string;
    question: string;
    answer: string;
    unansweredQueryId?: string | null;
  },
) {
  const rawText = buildVerifiedKnowledgeText(input.question, input.answer);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_sources")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: truncate(`Verified answer: ${input.question}`, 120),
      description: "Customer-approved answer from the Questions queue.",
      source_type: "text",
      raw_text: rawText,
      file_size_bytes: 0,
      status: "pending",
      metadata: {
        flywheel: true,
        unansweredQueryId: input.unansweredQueryId ?? null,
      },
    })
    .select()
    .single();

  if (error || !data) {
    throw new FlywheelError(error?.message ?? "Failed to create knowledge source.");
  }

  const source = data as KnowledgeSourceRecord;

  try {
    await reserveKnowledgeStorage(
      input.workspaceId,
      source.id,
      Buffer.byteLength(rawText, "utf8"),
    );
  } catch (error) {
    await deleteKnowledgeSource(supabase, source.id);
    throw error;
  }

  return source;
}

export async function linkKnowledgeSourceToVerifiedAnswersFolder(
  supabase: SupabaseAny,
  input: {
    workspaceId: string;
    agentId: string;
    agentName: string;
    userId: string;
    knowledgeSourceId: string;
  },
) {
  const folder = await getOrCreateVerifiedAnswersFolder(supabase, input);
  const { error: sourceLinkError } = await supabase
    .from("knowledge_folder_sources")
    .upsert(
      {
        folder_id: folder.id,
        knowledge_source_id: input.knowledgeSourceId,
      },
      { onConflict: "folder_id,knowledge_source_id" },
    );

  if (sourceLinkError) {
    throw new FlywheelError(sourceLinkError.message);
  }

  const { error: agentFolderError } = await supabase
    .from("agent_knowledge_folders")
    .upsert(
      {
        agent_id: input.agentId,
        knowledge_folder_id: folder.id,
      },
      { onConflict: "agent_id,knowledge_folder_id" },
    );

  if (agentFolderError) {
    throw new FlywheelError(agentFolderError.message);
  }

  return folder;
}

export function queueKnowledgeProcessing(
  supabase: SupabaseAny,
  sourceId: string,
  accessToken?: string | null,
) {
  after(async () => {
    const admin = createAdminClient();
    const processResponse = await supabase.functions.invoke(
      "process-knowledge-source",
      {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
        body: { sourceId },
      },
    );

    if (!processResponse.error) {
      return;
    }

    const { data: failedSource } = await supabase
      .from("knowledge_sources")
      .select("error_message")
      .eq("id", sourceId)
      .maybeSingle();
    const errorMessage =
      failedSource?.error_message ??
      processResponse.error.message ??
      "Knowledge processing failed.";

    console.error("[flywheel] Knowledge processing failed.", {
      sourceId,
      error: errorMessage,
    });

    await admin
      .from("knowledge_sources")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", sourceId);
  });
}

export async function publishVerifiedAnswer(
  supabase: SupabaseAny,
  input: PublishVerifiedAnswerInput,
) {
  const answer = input.answer.trim();
  const visibility = input.visibility ?? "agent_only";

  if (answer.length < 2) {
    throw new FlywheelError("Answer is required.", 400);
  }

  if (!["agent_only", "public_ready"].includes(visibility)) {
    throw new FlywheelError("Invalid visibility.", 400);
  }

  const { data: query, error: queryError } = await supabase
    .from("unanswered_queries")
    .select("*")
    .eq("id", input.queryId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (queryError) {
    throw new FlywheelError(queryError.message);
  }

  if (!query) {
    throw new FlywheelError("Question not found.", 404);
  }

  const unansweredQuery = query as UnansweredQueryRecord;
  const agent = await loadAgentForEdit(supabase, {
    workspaceId: input.workspaceId,
    agentId: unansweredQuery.agent_id,
    userId: input.userId,
    membershipRole: input.membershipRole,
  });

  if (unansweredQuery.status === "duplicate") {
    throw new FlywheelError("Duplicate questions cannot be answered directly.", 409);
  }

  const source = await createKnowledgeSourceFromVerifiedFact(supabase, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    question: unansweredQuery.question,
    answer,
    unansweredQueryId: unansweredQuery.id,
  });

  try {
    await linkKnowledgeSourceToVerifiedAnswersFolder(supabase, {
      workspaceId: input.workspaceId,
      agentId: unansweredQuery.agent_id,
      agentName: agent.name,
      userId: input.userId,
      knowledgeSourceId: source.id,
    });
  } catch (error) {
    await deleteKnowledgeSource(supabase, source.id);
    throw error;
  }

  const now = new Date().toISOString();
  const { data: fact, error: factError } = await supabase
    .from("verified_facts")
    .insert({
      workspace_id: input.workspaceId,
      agent_id: unansweredQuery.agent_id,
      unanswered_query_id: unansweredQuery.id,
      created_by: input.userId,
      question: unansweredQuery.question,
      answer,
      status: "published",
      visibility,
      knowledge_source_id: source.id,
      published_at: now,
      metadata: {
        assistantAnswer: unansweredQuery.assistant_answer,
        detectionReason: unansweredQuery.detection_reason,
      },
    })
    .select()
    .single();

  if (factError || !fact) {
    await deleteKnowledgeSource(supabase, source.id);
    throw new FlywheelError(factError?.message ?? "Failed to create verified fact.");
  }

  const verifiedFact = fact as VerifiedFactRecord;

  await createAdminClient()
    .from("knowledge_sources")
    .update({
      metadata: {
        ...source.metadata,
        verifiedFactId: verifiedFact.id,
      },
    })
    .eq("id", source.id);

  const { error: updateQueryError } = await supabase
    .from("unanswered_queries")
    .update({
      status: "answered",
      resolved_at: now,
    })
    .eq("id", unansweredQuery.id);

  if (updateQueryError) {
    throw new FlywheelError(updateQueryError.message);
  }

  queueKnowledgeProcessing(supabase, source.id, input.accessToken);

  return {
    query: {
      ...unansweredQuery,
      status: "answered" as const,
      resolved_at: now,
    },
    fact: verifiedFact,
    source,
  };
}

export async function updateUnansweredQueryDisposition(
  supabase: SupabaseAny,
  input: UpdateQuestionDispositionInput,
) {
  const { data: query, error: queryError } = await supabase
    .from("unanswered_queries")
    .select("*")
    .eq("id", input.queryId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (queryError) {
    throw new FlywheelError(queryError.message);
  }

  if (!query) {
    throw new FlywheelError("Question not found.", 404);
  }

  const unansweredQuery = query as UnansweredQueryRecord;
  await loadAgentForEdit(supabase, {
    workspaceId: input.workspaceId,
    agentId: unansweredQuery.agent_id,
    userId: input.userId,
    membershipRole: input.membershipRole,
  });

  const now = new Date().toISOString();
  const { data: existingFact, error: factLookupError } = await supabase
    .from("verified_facts")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("unanswered_query_id", unansweredQuery.id)
    .maybeSingle();

  if (factLookupError) {
    throw new FlywheelError(factLookupError.message);
  }

  let patch: Partial<UnansweredQueryRecord>;
  const duplicateOf =
    input.action === "mark_duplicate" ? input.duplicateOf?.trim() : undefined;

  try {
    patch = buildUnansweredQueryDispositionPatch({
      action: input.action,
      currentStatus: unansweredQuery.status,
      hasVerifiedFact: Boolean(existingFact),
      questionId: unansweredQuery.id,
      duplicateOf,
      resolvedAt: now,
    });
  } catch (error) {
    if (error instanceof InvalidQuestionDispositionError) {
      throw new FlywheelError(error.message, error.status);
    }

    throw error;
  }

  if (input.action === "mark_duplicate") {
    const { data: original, error: originalError } = await supabase
      .from("unanswered_queries")
      .select("id, agent_id, status")
      .eq("id", duplicateOf)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();

    if (originalError) {
      throw new FlywheelError(originalError.message);
    }

    try {
      const originalRow = original as {
        id: string;
        agent_id: string;
        status: UnansweredQueryStatus;
      } | null;

      validateDuplicateTarget({
        original: originalRow
          ? {
              id: originalRow.id,
              agentId: originalRow.agent_id,
              status: originalRow.status,
            }
          : null,
        currentAgentId: unansweredQuery.agent_id,
      });
    } catch (error) {
      if (error instanceof InvalidQuestionDispositionError) {
        throw new FlywheelError(error.message, error.status);
      }

      throw error;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("unanswered_queries")
    .update(patch)
    .eq("id", unansweredQuery.id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new FlywheelError(updateError?.message ?? "Failed to update question.");
  }

  return updated as UnansweredQueryRecord;
}

export async function retryVerifiedFactKnowledgeProcessing(
  supabase: SupabaseAny,
  input: RetryKnowledgeProcessingInput,
) {
  const { data: fact, error } = await supabase
    .from("verified_facts")
    .select("*")
    .eq("id", input.verifiedFactId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  if (!fact) {
    throw new FlywheelError("Verified fact not found.", 404);
  }

  const verifiedFact = fact as VerifiedFactRecord;
  await loadAgentForEdit(supabase, {
    workspaceId: input.workspaceId,
    agentId: verifiedFact.agent_id,
    userId: input.userId,
    membershipRole: input.membershipRole,
  });

  if (!verifiedFact.knowledge_source_id) {
    throw new FlywheelError("This verified fact has no linked knowledge source.", 409);
  }

  const { error: updateError } = await createAdminClient()
    .from("knowledge_sources")
    .update({
      status: "pending",
      error_message: null,
    })
    .eq("id", verifiedFact.knowledge_source_id);

  if (updateError) {
    throw new FlywheelError(updateError.message);
  }

  queueKnowledgeProcessing(supabase, verifiedFact.knowledge_source_id, input.accessToken);

  return { ok: true };
}

export async function updateVerifiedFactAnswer(
  supabase: SupabaseAny,
  input: UpdateVerifiedFactInput,
) {
  const answer = input.answer.trim();
  const visibility = input.visibility ?? "agent_only";

  if (answer.length < 2) {
    throw new FlywheelError("Answer is required.", 400);
  }

  if (!["agent_only", "public_ready"].includes(visibility)) {
    throw new FlywheelError("Invalid visibility.", 400);
  }

  const { data: fact, error } = await supabase
    .from("verified_facts")
    .select("*")
    .eq("id", input.verifiedFactId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) {
    throw new FlywheelError(error.message);
  }

  if (!fact) {
    throw new FlywheelError("Verified fact not found.", 404);
  }

  const verifiedFact = fact as VerifiedFactRecord;
  await loadAgentForEdit(supabase, {
    workspaceId: input.workspaceId,
    agentId: verifiedFact.agent_id,
    userId: input.userId,
    membershipRole: input.membershipRole,
  });

  if (!verifiedFact.knowledge_source_id) {
    throw new FlywheelError("This verified fact has no linked knowledge source.", 409);
  }

  const rawText = buildVerifiedKnowledgeText(verifiedFact.question, answer);
  await updateKnowledgeSourceText(
    input.workspaceId,
    verifiedFact.knowledge_source_id,
    rawText,
  );

  const { data: updatedFact, error: updateError } = await supabase
    .from("verified_facts")
    .update({
      answer,
      visibility,
      status: "published",
      retired_at: null,
      published_at: verifiedFact.published_at ?? new Date().toISOString(),
    })
    .eq("id", verifiedFact.id)
    .select()
    .single();

  if (updateError || !updatedFact) {
    throw new FlywheelError(updateError?.message ?? "Failed to update verified fact.");
  }

  queueKnowledgeProcessing(supabase, verifiedFact.knowledge_source_id, input.accessToken);

  return updatedFact as VerifiedFactRecord;
}
