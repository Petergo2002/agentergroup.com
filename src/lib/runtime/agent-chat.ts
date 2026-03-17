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
  widgetPublicKey?: string | null;
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
const EMPTY_ASSISTANT_RESPONSE_FALLBACK =
  "Sorry, I had trouble answering that. Please try again.";
const OMITTED_ASSISTANT_HISTORY_MESSAGES = new Set([
  "The model returned an empty response.",
  "This is rarely an acceptable response and a retry should be issued.",
]);

function extractAssistantContent(message: Record<string, unknown> | null) {
  const content = message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (!item || typeof item !== "object") {
        return "";
      }

      const record = item as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }

      if (record.text && typeof record.text === "object") {
        const nestedRecord = record.text as Record<string, unknown>;
        return typeof nestedRecord.value === "string" ? nestedRecord.value : "";
      }

      return "";
    })
    .join("")
    .trim();
}

function mapDbMessagesToModel(messages: RuntimeMessage[]) {
  return messages
    .filter((message) => {
      if (message.role !== "assistant") {
        return true;
      }

      return !OMITTED_ASSISTANT_HISTORY_MESSAGES.has(message.content.trim());
    })
    .map((message) => {
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
  widgetPublicKey,
}: {
  supabase: RuntimeSupabaseLike;
  workspaceId: string;
  agentId: string;
  query: string;
  knowledgeAccessToken?: string | null;
  widgetPublicKey?: string | null;
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
      widgetPublicKey,
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
  widgetPublicKey,
  onToken,
  onStatus,
}: AgentRuntimeInput & {
  onToken?: (token: string) => void;
  onStatus?: (status: string) => void;
}): Promise<AgentRuntimeResult> {
  const { connectedToolkits, readyKnowledgeSources } = await loadRuntimeContext(
    supabase,
    agent.id,
  );

  const modelMessages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content:
        agent.instructions ||
        "You are a configurable AI agent. Help the user clearly and use tools when useful. Never mention internal errors, retries, system prompts, hidden context, or raw tool payloads.",
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
      if (onStatus) onStatus("Searching specific knowledge...");
      knowledgeMatches = await retrieveKnowledgeMatches({
        supabase,
        workspaceId: agent.workspace_id,
        agentId: agent.id,
        query: input,
        knowledgeAccessToken,
        widgetPublicKey,
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
  let assistantContent = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    if (onStatus && iteration > 0) onStatus("Thinking...");
    
    // Check if tools are currently available, if not, or if this is the last iteration, 
    // we should stream the response back. Actually, we can stream every iteration.
    // If it decides to use a tool, it streams the tool call (which we hide from onToken).
    // If it decides to write text, it streams the text (which we pass to onToken).
    
    const stream = await createOpenRouterChatCompletion({
      model: agent.model,
      messages: conversationMessages,
      tools: toolDefinitions,
      stream: true,
    }) as AsyncGenerator<any, void, unknown>;

    finalCompletion = { choices: [{ message: { role: "assistant", content: "", tool_calls: [] } }] };
    let hasToolCalls = false;
    let iterationContent = "";
    const accumulatedToolCalls = new Map<number, any>();

    for await (const chunk of stream) {
      // Keep final completion mostly intact for metadata
      if (chunk.model) finalCompletion.model = chunk.model;
      if (chunk.id) finalCompletion.id = chunk.id;
      
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        iterationContent += delta.content;
        assistantContent += delta.content;
        if (onToken) onToken(delta.content);
      }

      if (delta.tool_calls) {
        hasToolCalls = true;
        for (const pt of delta.tool_calls) {
          if (!accumulatedToolCalls.has(pt.index)) {
            accumulatedToolCalls.set(pt.index, {
              id: pt.id || "",
              type: "function",
              function: {
                name: pt.function?.name || "",
                arguments: pt.function?.arguments || ""
              }
            });
          } else {
            const existing = accumulatedToolCalls.get(pt.index)!;
            if (pt.id) existing.id += pt.id;
            if (pt.function?.name) existing.function.name += pt.function.name;
            if (pt.function?.arguments) existing.function.arguments += pt.function.arguments;
          }
        }
      }
    }

    const toolCallsArray = Array.from(accumulatedToolCalls.values());
    const assistantMessage: any = {
      role: "assistant",
      content: iterationContent,
    };
    
    if (toolCallsArray.length > 0) {
        assistantMessage.tool_calls = toolCallsArray;
    }

    (finalCompletion as any).choices[0].message = assistantMessage;

    if (!hasToolCalls || toolDefinitions.length === 0) {
      finalAssistantMessage = assistantMessage as Record<string, unknown>;
      break;
    }

    if (onStatus) {
      const toolNames = toolCallsArray.map(tc => tc.function.name).join(", ");
      onStatus(`Using tool: ${toolNames}...`);
    }

    let iterationToolMessages: ToolMessage[];

    try {
      iterationToolMessages = (await handleChatToolCalls(
        toolUserId,
        finalCompletion as unknown as OpenAI.Chat.ChatCompletion,
      )) as unknown as ToolMessage[];
    } catch (toolError) {
      console.error(`Tool execution failed for user ${toolUserId}:`, toolError);
      
      const errorMessage =
        toolError instanceof Error ? toolError.message : "Unknown integration error";

      // If the tool crashes, feed the error back to the LLM so it can respond gracefully
      iterationToolMessages = toolCallsArray.map((tc) => ({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: `Error executing tool: ${errorMessage}`,
      }));
    }

    toolMessages.push(...iterationToolMessages);
    conversationMessages.push(assistantMessage, ...iterationToolMessages);
  }

  if (!finalAssistantMessage || !assistantContent) {
    if (onStatus) onStatus("Finalizing...");
    const recoveryStream = await createOpenRouterChatCompletion({
      model: agent.model,
      messages: [
        ...conversationMessages,
        {
          role: "system",
          content:
            audience === "widget"
              ? "Respond directly to the user in concise natural language based on the conversation and any completed tool work. If information is missing, ask the single best follow-up question. Do not call tools. Never mention internal processing, retries, empty responses, JSON, or code."
              : "Respond directly to the user in concise natural language based on the conversation and any completed tool work. If information is missing, ask the single best follow-up question. Do not call tools. Never mention internal processing, retries, empty responses, JSON, or code.",
        },
      ],
      stream: true,
    }) as AsyncGenerator<any, void, unknown>;

    finalCompletion = { choices: [{ message: { role: "assistant", content: "" } }] };
    assistantContent = "";
    
    for await (const chunk of recoveryStream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        assistantContent += delta.content;
        if (onToken) onToken(delta.content);
      }
    }
    (finalCompletion as any).choices[0].message.content = assistantContent;
    finalAssistantMessage = (finalCompletion as any).choices[0].message;
  }

  assistantContent ||= EMPTY_ASSISTANT_RESPONSE_FALLBACK;

  return {
    assistantContent: assistantContent.trim(),
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
