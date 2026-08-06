import "server-only";

import { canEditAgentRecord } from "@/lib/agents/access";
import {
  extractPdfDownloadsFromAssistantMetadata,
  extractPdfDownloadsFromToolMessage,
} from "@/lib/assistants/downloads";
import type {
  AgentRecord,
  AssistantConversationMessage,
  AssistantListItem,
  AssistantThreadSummary,
  ThreadRecord,
  WorkspaceMemberRecord,
} from "@/lib/types";
import { WORKSPACE_ASSISTANT_LIST_LIMIT } from "@/lib/query-limits";

interface AssistantThreadLockRow {
  thread_id: string | null;
  source: string | null;
  active_turn_request_id: string | null;
  active_turn_started_at: string | null;
  acquired: boolean;
}

interface ProfileLookupRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AdminQueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface AdminQueryBuilder extends PromiseLike<AdminQueryResult> {
  select: (columns?: string) => AdminQueryBuilder;
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[],
  ) => AdminQueryBuilder;
  update: (values: Record<string, unknown>) => AdminQueryBuilder;
  delete: () => AdminQueryBuilder;
  eq: (column: string, value: unknown) => AdminQueryBuilder;
  neq: (column: string, value: unknown) => AdminQueryBuilder;
  is: (column: string, value: unknown) => AdminQueryBuilder;
  in: (column: string, values: unknown[]) => AdminQueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => AdminQueryBuilder;
  limit: (count: number) => AdminQueryBuilder;
  maybeSingle: () => Promise<AdminQueryResult>;
  single: () => Promise<AdminQueryResult>;
}

interface AdminSupabaseLike {
  from: (table: string) => AdminQueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<AdminQueryResult>;
}

const ASSISTANT_TURN_STALE_MS = 10 * 60 * 1000;

function throwOnError(error: { message?: string } | null | undefined, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function truncateSnippet(value: string | null | undefined, maxLength = 120) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}…`;
}

function buildSenderName(
  message: {
    role: string;
    created_by: string | null;
  },
  assistantName: string,
  profilesById: Map<string, ProfileLookupRow>,
) {
  if (message.role === "assistant") {
    return assistantName;
  }

  if (!message.created_by) {
    return null;
  }

  const profile = profilesById.get(message.created_by);
  return profile?.full_name?.trim() || profile?.email || null;
}

export async function loadAssistantById(
  admin: AdminSupabaseLike,
  assistantId: string,
  workspaceId: string,
) {
  const { data, error } = await admin
    .from("agents")
    .select("*")
    .eq("id", assistantId)
    .eq("workspace_id", workspaceId)
    .eq("surface", "assistant")
    .maybeSingle();

  throwOnError(error, "Failed to load assistant.");

  return (data ?? null) as AgentRecord | null;
}

export async function listWorkspaceAssistants(
  admin: AdminSupabaseLike,
  args: {
    workspaceId: string;
    actorUserId: string;
    membershipRole: WorkspaceMemberRecord["role"];
  },
) {
  const { data, error } = await admin
    .from("agents")
    .select("*")
    .eq("workspace_id", args.workspaceId)
    .eq("surface", "assistant")
    .is("archived_at", null)
    .neq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(WORKSPACE_ASSISTANT_LIST_LIMIT);

  throwOnError(error, "Failed to load assistants.");

  const assistants = (data ?? []) as AgentRecord[];

  if (assistants.length === 0) {
    return [] as AssistantListItem[];
  }

  const assistantIds = assistants.map((assistant) => assistant.id);
  const threadsResult = await admin
    .from("chat_threads")
    .select("id, agent_id")
    .in("agent_id", assistantIds)
    .eq("source", "assistant")
    .eq("created_by", args.actorUserId);

  throwOnError(threadsResult.error, "Failed to load assistant threads.");

  const threadRows = (threadsResult.data ?? []) as Array<{
    id: string;
    agent_id: string;
  }>;
  const threadIds = threadRows.map((thread) => thread.id);
  const threadIdsByAssistantId = new Map<string, string[]>();

  for (const thread of threadRows) {
    const existing = threadIdsByAssistantId.get(thread.agent_id) ?? [];
    existing.push(thread.id);
    threadIdsByAssistantId.set(thread.agent_id, existing);
  }

  const latestMessageByThreadId = new Map<string, string>();

  if (threadIds.length > 0) {
    const messagesResult = await admin
      .from("messages")
      .select("thread_id, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    throwOnError(messagesResult.error, "Failed to load assistant activity.");

    for (const message of ((messagesResult.data ?? []) as Array<{
      thread_id: string;
      created_at: string;
    }>)) {
      if (!latestMessageByThreadId.has(message.thread_id)) {
        latestMessageByThreadId.set(message.thread_id, message.created_at);
      }
    }
  }

  return assistants.map((assistant) => {
    const assistantThreadIds = threadIdsByAssistantId.get(assistant.id) ?? [];
    const lastActivityAt =
      assistantThreadIds
        .map((threadId) => latestMessageByThreadId.get(threadId) ?? null)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return {
      id: assistant.id,
      name: assistant.name,
      description: assistant.description,
      model: assistant.model,
      status: assistant.status,
      surface: assistant.surface,
      createdBy: assistant.created_by,
      updatedAt: assistant.updated_at,
      threadCount: assistantThreadIds.length,
      lastActivityAt,
      canEdit: canEditAgentRecord(
        assistant,
        args.actorUserId,
        args.membershipRole,
      ),
    } satisfies AssistantListItem;
  });
}

export async function loadAssistantThreads(
  admin: AdminSupabaseLike,
  assistant: Pick<AgentRecord, "id" | "workspace_id">,
  actorUserId: string,
) {
  const threadsResult = await admin
    .from("chat_threads")
    .select("*")
    .eq("agent_id", assistant.id)
    .eq("workspace_id", assistant.workspace_id)
    .eq("source", "assistant")
    .eq("created_by", actorUserId)
    .order("updated_at", { ascending: false });

  throwOnError(threadsResult.error, "Failed to load assistant threads.");

  const threads = (threadsResult.data ?? []) as ThreadRecord[];

  if (threads.length === 0) {
    return [] as AssistantThreadSummary[];
  }

  const threadIds = threads.map((thread) => thread.id);
  const messagesResult = await admin
    .from("messages")
    .select("id, thread_id, content, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  throwOnError(messagesResult.error, "Failed to load assistant thread activity.");

  const latestMessageByThreadId = new Map<string, { created_at: string; content: string | null }>();
  const messageCountByThreadId = new Map<string, number>();

  for (const message of ((messagesResult.data ?? []) as Array<{
    id: string;
    thread_id: string;
    content: string | null;
    created_at: string;
  }>)) {
    if (!latestMessageByThreadId.has(message.thread_id)) {
      latestMessageByThreadId.set(message.thread_id, {
        created_at: message.created_at,
        content: message.content,
      });
    }

    messageCountByThreadId.set(
      message.thread_id,
      (messageCountByThreadId.get(message.thread_id) ?? 0) + 1,
    );
  }

  return threads.map((thread) => {
    const latestMessage = latestMessageByThreadId.get(thread.id);
    return {
      id: thread.id,
      title: thread.title,
      source: thread.source,
      createdBy: thread.created_by,
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      messageCount: messageCountByThreadId.get(thread.id) ?? 0,
      lastMessageAt: latestMessage?.created_at ?? null,
      lastMessageSnippet: truncateSnippet(latestMessage?.content),
    } satisfies AssistantThreadSummary;
  });
}

export async function loadAssistantThread(
  admin: AdminSupabaseLike,
  args: {
    threadId: string;
    assistantId: string;
    workspaceId: string;
    actorUserId: string;
  },
) {
  const result = await admin
    .from("chat_threads")
    .select("*")
    .eq("id", args.threadId)
    .eq("agent_id", args.assistantId)
    .eq("workspace_id", args.workspaceId)
    .eq("source", "assistant")
    .eq("created_by", args.actorUserId)
    .maybeSingle();

  throwOnError(result.error, "Failed to load assistant thread.");

  return (result.data ?? null) as ThreadRecord | null;
}

export async function createAssistantThread(
  admin: AdminSupabaseLike,
  input: {
    workspaceId: string;
    assistantId: string;
    actorUserId: string;
    title?: string | null;
  },
) {
  const { data, error } = await admin
    .from("chat_threads")
    .insert({
      workspace_id: input.workspaceId,
      agent_id: input.assistantId,
      source: "assistant",
      title: input.title?.trim() || "New chat",
      created_by: input.actorUserId,
    })
    .select()
    .single();

  throwOnError(error, "Failed to create assistant thread.");

  return data as ThreadRecord;
}

export async function loadAssistantMessages(
  admin: AdminSupabaseLike,
  args: {
    threadId: string;
    assistantName: string;
  },
) {
  const messagesResult = await admin
    .from("messages")
    .select("*")
    .eq("thread_id", args.threadId)
    .order("created_at", { ascending: true });

  throwOnError(messagesResult.error, "Failed to load assistant messages.");

  const messages = (messagesResult.data ?? []) as Array<{
    id: string;
    thread_id: string;
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_name: string | null;
    tool_call_id: string | null;
    metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
  }>;

  const profileIds = Array.from(
    new Set(messages.map((message) => message.created_by).filter(Boolean)),
  ) as string[];
  const profilesById = new Map<string, ProfileLookupRow>();

  if (profileIds.length > 0) {
    const profilesResult = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);

    throwOnError(profilesResult.error, "Failed to load assistant participants.");

    for (const profile of (profilesResult.data ?? []) as ProfileLookupRow[]) {
      profilesById.set(profile.id, profile);
    }
  }

  return messages.reduce<AssistantConversationMessage[]>((accumulator, message) => {
      if (message.role === "tool") {
        const downloads = extractPdfDownloadsFromToolMessage({
          content: message.content,
          metadata: message.metadata,
          toolName: message.tool_name,
        });

        if (downloads.length === 0) {
          return accumulator;
        }

        accumulator.push({
          id: message.id,
          threadId: message.thread_id,
          role: "tool",
          content:
            downloads.length === 1
              ? `${downloads[0].filename} is ready to download.`
              : `${downloads.length} PDF files are ready to download.`,
          toolName: message.tool_name,
          toolCallId: message.tool_call_id,
          metadata: message.metadata,
          createdBy: message.created_by,
          createdAt: message.created_at,
          senderName: args.assistantName,
          downloads,
        });

        return accumulator;
      }

      accumulator.push({
        id: message.id,
        threadId: message.thread_id,
        role: message.role,
        content: message.content,
        toolName: message.tool_name,
        toolCallId: message.tool_call_id,
        metadata: message.metadata,
        createdBy: message.created_by,
        createdAt: message.created_at,
        senderName: buildSenderName(message, args.assistantName, profilesById),
        downloads:
          message.role === "assistant"
            ? extractPdfDownloadsFromAssistantMetadata(message.metadata)
            : [],
      });

      return accumulator;
    }, []);
}

export async function acquireAssistantThreadTurnLock(
  admin: AdminSupabaseLike,
  threadId: string,
  requestId: string,
) {
  const startedAt = new Date();
  const staleBefore = new Date(startedAt.getTime() - ASSISTANT_TURN_STALE_MS);
  const { data, error } = await admin.rpc("acquire_chat_thread_turn_lock", {
    p_thread_id: threadId,
    p_request_id: requestId,
    p_started_at: startedAt.toISOString(),
    p_stale_before: staleBefore.toISOString(),
  });

  throwOnError(error, "Failed to acquire assistant thread lock.");

  const row = Array.isArray(data)
    ? ((data[0] ?? null) as AssistantThreadLockRow | null)
    : null;

  return {
    acquired: Boolean(row?.acquired),
    row,
  };
}

export async function releaseAssistantThreadTurnLock(
  admin: AdminSupabaseLike,
  threadId: string,
  requestId: string,
) {
  const { error } = await admin.rpc("release_chat_thread_turn_lock", {
    p_thread_id: threadId,
    p_request_id: requestId,
  });

  throwOnError(error, "Failed to release assistant thread lock.");
}
