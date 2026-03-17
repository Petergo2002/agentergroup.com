import type OpenAI from "openai";
import { getWrappedTools, handleChatToolCalls } from "@/lib/composio";
import { getSupportedIntegration } from "@/lib/integrations";
import {
  buildKnowledgeContext,
  getKnowledgeCitationSummary,
  KNOWLEDGE_MATCH_COUNT,
  KNOWLEDGE_MATCH_THRESHOLD,
} from "@/lib/knowledge";
import { createOpenRouterChatCompletion } from "@/lib/openrouter";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import type { AgentRecord, KnowledgeMatchRecord } from "@/lib/types";

interface RuntimeSelectQueryResult {
  data?: unknown[] | null;
}

interface RuntimeSelectQuery {
  eq: (column: string, value: string) => Promise<RuntimeSelectQueryResult>;
}

interface RuntimeTableQuery {
  select: (columns: string) => RuntimeSelectQuery;
}

interface RuntimeSupabaseLike {
  from: (table: string) => RuntimeTableQuery;
  functions: {
    invoke: (
      functionName: string,
      options: {
        headers?: Record<string, string>;
        body?: Record<string, unknown>;
      },
    ) => Promise<{
      data?: Record<string, unknown> | null;
      error?: { message: string } | null;
    }>;
  };
}

interface RuntimeMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string | null;
}

interface ToolMessage {
  content?: string;
  name?: string;
  tool_call_id?: string;
  [key: string]: unknown;
}

interface ModelToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface AttachedConnectionRow {
  connection: {
    toolkit_slug: string;
    status: string;
  } | null;
}

interface AttachedKnowledgeRow {
  source: {
    id: string;
    name: string;
    status: string;
  } | null;
}

export interface AgentRuntimeInput {
  supabase: RuntimeSupabaseLike;
  agent: Pick<
    AgentRecord,
    "id" | "workspace_id" | "name" | "model" | "instructions" | "created_by"
  >;
  input: string;
  history: RuntimeMessage[];
  toolUserId: string;
  audience: "preview" | "widget";
  knowledgeAccessToken?: string | null;
}

export interface AgentRuntimeResult {
  assistantContent: string;
  assistantMetadata: Record<string, unknown>;
  finalCompletion: Record<string, unknown> | null;
  toolMessages: ToolMessage[];
  knowledgeMatches: KnowledgeMatchRecord[];
  connectedToolkits: string[];
}

const MAX_TOOL_ITERATIONS = 6;

function mapDbMessagesToModel(messages: RuntimeMessage[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.tool_call_id,
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}

function buildToolGuidance(toolkitSlugs: string[]) {
  const availableIntegrations = Array.from(new Set(toolkitSlugs))
    .map((toolkitSlug) => getSupportedIntegration(toolkitSlug))
    .filter(
      (
        integration,
      ): integration is NonNullable<ReturnType<typeof getSupportedIntegration>> =>
        Boolean(integration),
    );

  if (availableIntegrations.length === 0) {
    return null;
  }

  const toolNames = availableIntegrations
    .map((integration) => integration.displayName)
    .join(", ");

  return [
    `Available connected tools: ${toolNames}.`,
    "If the user asks for an action that matches an available tool, prefer using the tool or asking a short follow-up question for missing details.",
    "Do not claim you lack the ability to do something if an attached tool can handle it.",
    "For meeting booking or calendar availability, use Google Calendar when it is attached.",
    "For email sending, use Gmail when it is attached.",
    "After using tools, answer the user in natural language with the outcome. Never return raw JSON, code, or tool payloads to the user.",
  ].join(" ");
}

async function loadRuntimeContext(
  supabase: RuntimeSupabaseLike,
  agentId: string,
) {
  const [{ data: attachedConnections }, { data: attachedKnowledgeSources }] =
    await Promise.all([
      supabase
        .from("agent_connections")
        .select("connection:connections(toolkit_slug, status)")
        .eq("agent_id", agentId),
      supabase
        .from("agent_knowledge_sources")
        .select("source:knowledge_sources(id, name, status)")
        .eq("agent_id", agentId),
    ]);

  const connectedToolkits = (
    (attachedConnections ?? []) as unknown as AttachedConnectionRow[]
  )
    .map((item) => item.connection)
    .filter(
      (
        connection,
      ): connection is NonNullable<AttachedConnectionRow["connection"]> =>
        Boolean(connection?.status === "connected"),
    )
    .map((connection) => connection.toolkit_slug);

  const readyKnowledgeSources = (
    (attachedKnowledgeSources ?? []) as unknown as AttachedKnowledgeRow[]
  )
    .map((item) => item.source)
    .filter(
      (
        source,
      ): source is NonNullable<AttachedKnowledgeRow["source"]> =>
        Boolean(source?.status === "ready"),
    );

  return {
    connectedToolkits,
    readyKnowledgeSources,
  };
}

async function retrieveKnowledgeMatches({
  supabase,
  workspaceId,
  agentId,
  query,
  knowledgeAccessToken,
}: {
  supabase: RuntimeSupabaseLike;
  workspaceId: string;
  agentId: string;
  query: string;
  knowledgeAccessToken?: string | null;
}) {
  void supabase;

  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const isUserScopedRequest = Boolean(knowledgeAccessToken);
  const authToken = knowledgeAccessToken ?? serviceRoleKey;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
    apikey: isUserScopedRequest ? authToken : serviceRoleKey,
  };

  if (!isUserScopedRequest) {
    headers["x-internal-service-key"] = serviceRoleKey;
  }

  const response = await fetch(`${url}/functions/v1/search-knowledge`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspaceId,
      agentId,
      query,
      matchThreshold: KNOWLEDGE_MATCH_THRESHOLD,
      matchCount: KNOWLEDGE_MATCH_COUNT,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; matches?: KnowledgeMatchRecord[] }
    | null;

  if (!response.ok) {
    const errorMessage =
      payload?.error ||
      `search-knowledge returned ${response.status} for ${
        isUserScopedRequest ? "user" : "internal"
      } auth.`;
    throw new Error(errorMessage);
  }

  return ((payload?.matches ?? []) as KnowledgeMatchRecord[]).filter(
    (match) => typeof match.content === "string" && match.content.length > 0,
  );
}

export async function runAgentChat({
  supabase,
  agent,
  input,
  history,
  toolUserId,
  audience,
  knowledgeAccessToken,
}: AgentRuntimeInput): Promise<AgentRuntimeResult> {
  const { connectedToolkits, readyKnowledgeSources } = await loadRuntimeContext(
    supabase,
    agent.id,
  );

  const modelMessages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content:
        agent.instructions ||
        "You are a configurable AI agent. Help the user clearly and use tools when useful.",
    },
    ...mapDbMessagesToModel(history),
  ];

  const toolGuidance = buildToolGuidance(connectedToolkits);

  if (toolGuidance) {
    modelMessages.splice(1, 0, {
      role: "system",
      content: toolGuidance,
    });
  }

  let knowledgeMatches: KnowledgeMatchRecord[] = [];

  if (readyKnowledgeSources.length > 0) {
    try {
      knowledgeMatches = await retrieveKnowledgeMatches({
        supabase,
        workspaceId: agent.workspace_id,
        agentId: agent.id,
        query: input,
        knowledgeAccessToken,
      });

      const knowledgeContext = buildKnowledgeContext(knowledgeMatches);

      if (knowledgeContext) {
        modelMessages.splice(1, 0, {
          role: "system",
          content: knowledgeContext,
        });
      }
    } catch (error) {
      console.error("Knowledge retrieval failed; continuing without knowledge.", {
        agentId: agent.id,
        workspaceId: agent.workspace_id,
        audience,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const tools = await getWrappedTools(toolUserId, connectedToolkits);
  const toolDefinitions = tools as unknown as Array<Record<string, unknown>>;
  const conversationMessages = [...modelMessages];
  const toolMessages: ToolMessage[] = [];
  let finalCompletion: Record<string, unknown> | null = null;
  let finalAssistantMessage: Record<string, unknown> | null = null;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const completion = await createOpenRouterChatCompletion({
      model: agent.model,
      messages: conversationMessages,
      tools: toolDefinitions,
    });

    finalCompletion = completion as Record<string, unknown>;
    const assistantMessage = completion?.choices?.[0]?.message as
      | Record<string, unknown>
      | undefined;
    const toolCalls = (assistantMessage?.tool_calls ?? []) as unknown as ModelToolCall[];

    if (!assistantMessage) {
      break;
    }

    if (toolCalls.length === 0 || toolDefinitions.length === 0) {
      finalAssistantMessage = assistantMessage;
      break;
    }

    const iterationToolMessages = (await handleChatToolCalls(
      toolUserId,
      completion as OpenAI.Chat.ChatCompletion,
    )) as unknown as ToolMessage[];

    toolMessages.push(...iterationToolMessages);
    conversationMessages.push(assistantMessage, ...iterationToolMessages);
  }

  if (!finalAssistantMessage) {
    const recoveryCompletion = await createOpenRouterChatCompletion({
      model: agent.model,
      messages: [
        ...conversationMessages,
        {
          role: "system",
          content:
            audience === "widget"
              ? "Respond to the user in concise natural language based on the completed tool work. Do not call tools. Do not return JSON or code."
              : "Respond to the user in concise natural language based on the completed tool work. Do not call tools. Do not return JSON or code.",
        },
      ],
    });

    finalCompletion = recoveryCompletion as Record<string, unknown>;
    finalAssistantMessage =
      (recoveryCompletion?.choices?.[0]?.message as
        | Record<string, unknown>
        | undefined) ?? null;
  }

  const assistantContent =
    (typeof finalAssistantMessage?.content === "string" &&
      finalAssistantMessage.content) ||
    "The model returned an empty response.";

  return {
    assistantContent,
    assistantMetadata: {
      ...(finalAssistantMessage ?? {}),
      knowledgeMatches: getKnowledgeCitationSummary(knowledgeMatches),
    },
    finalCompletion,
    toolMessages,
    knowledgeMatches,
    connectedToolkits,
  };
}
