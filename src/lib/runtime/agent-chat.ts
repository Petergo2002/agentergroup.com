import type OpenAI from "openai";
import { generatePdfFromText } from "@/lib/assistants/pdf";
import { sanitizeAssistantDownloadFilename } from "@/lib/assistants/downloads";
import { getConnectionComposioUserId } from "@/lib/connections";
import { getWrappedTools, handleChatToolCalls } from "@/lib/composio";
import {
  buildDisabledEndChatPolicy,
  buildEndChatMetadata,
} from "@/lib/end-chat";
import { buildPersistedDebugTrace } from "@/lib/debug-trace-security";
import {
  buildDefaultGmailRecipientPolicy,
  normalizeGmailRecipientEmail,
} from "@/lib/gmail";
import { getSupportedIntegration } from "@/lib/integrations";
import {
  buildKnowledgeContext,
  getKnowledgeCitationSummary,
  KNOWLEDGE_MATCH_COUNT,
  KNOWLEDGE_MATCH_THRESHOLD,
} from "@/lib/knowledge";
import { createOpenRouterChatCompletion } from "@/lib/openrouter";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import type {
  AgentRecord,
  EndChatMetadata,
  EndChatPolicy,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
  KnowledgeMatchRecord,
} from "@/lib/types";

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
  metadata?: Record<string, unknown> | null;
}

interface ToolMessage {
  content?: string;
  name?: string;
  tool_call_id?: string;
  [key: string]: unknown;
}

type ToolDefinitionLike = Record<string, unknown> & {
  function?: {
    name?: string;
  };
};


/** Shape of a single chunk from an OpenRouter streaming response. */
interface StreamChunkToolCallPart {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamChunkDelta {
  content?: string;
  tool_calls?: StreamChunkToolCallPart[];
}

interface StreamChunk {
  id?: string;
  model?: string;
  choices?: Array<{ delta?: StreamChunkDelta }>;
}

interface AttachedConnectionRow {
  connection: {
    toolkit_slug: string;
    status: string;
    toolkit_data: Record<string, unknown> | null;
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
    | "id"
    | "workspace_id"
    | "name"
    | "model"
    | "instructions"
    | "created_by"
    | "timezone"
    | "surface"
  >;
  input: string;
  history: RuntimeMessage[];
  toolUserId: string;
  audience: "preview" | "assistant" | "widget";
  knowledgeAccessToken?: string | null;
  widgetPublicKey?: string | null;
  calendarTimezone?: string | null;
  googleCalendarSelection?: GoogleCalendarSelection | null;
  endChatPolicy?: EndChatPolicy | null;
  gmailRecipientPolicy?: GmailRecipientPolicy | null;
}

export interface AgentRuntimeResult {
  assistantContent: string;
  assistantMetadata: Record<string, unknown>;
  finalCompletion: Record<string, unknown> | null;
  toolMessages: ToolMessage[];
  knowledgeMatches: KnowledgeMatchRecord[];
  connectedToolkits: string[];
  debugTrace?: import("@/lib/types").DebugTrace;
  endChat: EndChatMetadata | null;
}

const MAX_TOOL_ITERATIONS = 6;
const EMPTY_ASSISTANT_RESPONSE_FALLBACK =
  "Sorry, I had trouble answering that. Please try again.";
const OMITTED_ASSISTANT_HISTORY_MESSAGES = new Set([
  "The model returned an empty response.",
  "This is rarely an acceptable response and a retry should be issued.",
]);
const INTERNAL_END_CHAT_TOOL_NAME = "suggest_end_chat";
const INTERNAL_ASSISTANT_TOOLKIT_PROMPT =
  "If the user asks for a downloadable PDF, a printable version, or wants content exported as a PDF, use the available PDF tool to generate it. After the tool finishes, briefly tell the user the PDF is ready to download.";
const INTERNAL_CREATE_PDF_TOOL_NAME = "create_pdf_from_text";
const INTERNAL_END_CHAT_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: INTERNAL_END_CHAT_TOOL_NAME,
    description:
      "Suggest that the current conversation should be marked complete.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Short internal reason explaining why the conversation is complete.",
        },
      },
      additionalProperties: false,
    },
  },
} satisfies Record<string, unknown>;
const INTERNAL_CREATE_PDF_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: INTERNAL_CREATE_PDF_TOOL_NAME,
    description:
      "Create a downloadable PDF from plain text for the user.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The full text content that should be placed into the PDF.",
        },
        filename: {
          type: "string",
          description: "Optional filename for the generated PDF.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
} satisfies Record<string, unknown>;

function createPdfToolMessage(
  toolCallId: string,
  rawArguments: string,
): ToolMessage {
  const parsedArgs = parseInternalToolArguments(rawArguments);
  const text =
    typeof parsedArgs?.text === "string" && parsedArgs.text.trim()
      ? parsedArgs.text.trim()
      : null;

  if (!text) {
    return {
      role: "tool",
      tool_call_id: toolCallId,
      name: INTERNAL_CREATE_PDF_TOOL_NAME,
      content:
        "PDF generation failed because no text content was provided.",
      error: "Missing text for PDF generation.",
    };
  }

  const requestedFilename =
    typeof parsedArgs?.filename === "string" ? parsedArgs.filename : null;
  const filename = sanitizeAssistantDownloadFilename(
    requestedFilename?.trim() || "generated-document.pdf",
  );
  const pdfBytes = generatePdfFromText(text);

  return {
    role: "tool",
    tool_call_id: toolCallId,
    name: INTERNAL_CREATE_PDF_TOOL_NAME,
    content:
      `A downloadable PDF named "${filename}" has been prepared for the user. ` +
      "Do not invent sandbox paths, markdown file links, or raw URLs. " +
      "Tell the user the PDF is ready to download below.",
    generated_file: {
      filename,
      mime_type: "application/pdf",
      data_base64: pdfBytes.toString("base64"),
    },
  };
}



function mapDbMessagesToModel(messages: RuntimeMessage[]) {
  return messages
    .filter((message) => {
      if (message.role === "tool") {
        return false;
      }

      if (message.role !== "assistant") {
        return true;
      }

      return !OMITTED_ASSISTANT_HISTORY_MESSAGES.has(message.content.trim());
    })
    .map((message) => {
      const result: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      if (
        message.role === "assistant" &&
        message.metadata &&
        Array.isArray(message.metadata.tool_calls)
      ) {
        result.tool_calls = message.metadata.tool_calls;
      }

      return result;
    });
}

function buildToolGuidance(
  toolkitSlugs: string[],
  gmailRecipientPolicy: GmailRecipientPolicy,
  googleCalendarSelection: GoogleCalendarSelection | null,
) {
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

  const guidance = [
    `Available connected tools: ${toolNames}.`,
    "If the user asks for an action that matches an available tool, prefer using the tool or asking a short follow-up question for missing details.",
    "Do not claim you lack the ability to do something if an attached tool can handle it.",
    "For meeting booking or calendar availability, use Google Calendar when it is attached.",
    "For email sending, use Gmail when it is attached.",
    "After using tools, answer the user in natural language with the outcome. Never return raw JSON, code, or tool payloads to the user.",
  ];

  if (toolkitSlugs.includes("gmail")) {
    if (
      gmailRecipientPolicy.mode === "specific_email" &&
      normalizeGmailRecipientEmail(gmailRecipientPolicy.specificEmail)
    ) {
      guidance.push(
        "For Gmail, every email is an internal notification to a fixed hidden recipient configured by the workspace.",
      );
      guidance.push(
        "Never choose a different recipient and never reveal the actual internal email address to the user.",
      );
      guidance.push(
        "Describe the outcome as notifying the team, owner, or internal staff.",
      );
    } else {
      guidance.push(
        "For Gmail, choose the recipient based on the conversation, the user's request, and the agent instructions.",
      );
      guidance.push(
        "If those do not make the intended recipient clear enough, ask one concise follow-up question before sending.",
      );
    }
  }

  if (toolkitSlugs.includes("googlecalendar")) {
    const calendarLabel = googleCalendarSelection?.calendarLabel?.trim();
    const resolvedCalendarTimezone = googleCalendarSelection?.timezone?.trim();
    guidance.push(
      googleCalendarSelection?.calendarId
        ? googleCalendarSelection.includePrimaryCalendar
        ? calendarLabel
            ? `For Google Calendar scheduling, use the configured calendar "${calendarLabel}" and mirror bookings to the primary calendar as well.`
            : "For Google Calendar scheduling, use the configured calendar and mirror bookings to the primary calendar as well."
        : calendarLabel
          ? `For Google Calendar scheduling, use the configured calendar "${calendarLabel}" only for availability checks and bookings.`
          : "For Google Calendar scheduling, use the configured calendar only for availability checks and bookings."
        : "For Google Calendar scheduling, use the primary calendar unless a different booking calendar is configured.",
    );

    if (resolvedCalendarTimezone) {
      guidance.push(
        `For Google Calendar scheduling, treat ${resolvedCalendarTimezone} as the calendar timezone for availability checks and event creation.`,
      );
    }
  }

  return guidance.join(" ");
}

function buildEndChatGuidance(policy: EndChatPolicy) {
  if (!policy.enabled || !policy.allowAssistantSuggestion) {
    return null;
  }

  return [
    `An internal tool named ${INTERNAL_END_CHAT_TOOL_NAME} is available.`,
    "Use it only when the conversation is clearly complete, such as after a goodbye or when the user's goal has been fully resolved.",
    "Do not use it when more clarification, follow-up, or work is still needed.",
    "After using it, send a short natural closing message without mentioning tools or internal state.",
  ].join(" ");
}

function parseInternalToolArguments(rawArguments: string) {
  if (!rawArguments.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawArguments);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function loadRuntimeContext(
  supabase: RuntimeSupabaseLike,
  agentId: string,
  toolUserId: string,
) {
  const [{ data: attachedConnections }, { data: attachedKnowledgeSources }] =
    await Promise.all([
      supabase
        .from("agent_connections")
        .select("connection:connections(toolkit_slug, status, toolkit_data)")
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
        Boolean(
          connection?.status === "connected" &&
            getConnectionComposioUserId(connection) === toolUserId,
        ),
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
  calendarTimezone,
  googleCalendarSelection,
  endChatPolicy,
  gmailRecipientPolicy,
  onToken,
  onStatus,
}: AgentRuntimeInput & {
  onToken?: (token: string) => void;
  onStatus?: (status: string) => void;
}): Promise<AgentRuntimeResult> {
  const { connectedToolkits, readyKnowledgeSources } = await loadRuntimeContext(
    supabase,
    agent.id,
    toolUserId,
  );
  const effectiveEndChatPolicy = endChatPolicy ?? buildDisabledEndChatPolicy();
  const effectiveGmailRecipientPolicy: GmailRecipientPolicy =
    gmailRecipientPolicy ?? buildDefaultGmailRecipientPolicy();
  const enabledToolkits = connectedToolkits.filter((toolkitSlug) => {
    if (toolkitSlug !== "gmail") {
      return true;
    }

    return (
      effectiveGmailRecipientPolicy.mode !== "specific_email" ||
      Boolean(normalizeGmailRecipientEmail(effectiveGmailRecipientPolicy.specificEmail))
    );
  });

  const effectiveTimezone = calendarTimezone ?? agent.timezone ?? 'UTC';
  
  const timezoneContext = effectiveTimezone
    ? (() => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: effectiveTimezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });
        const timeString = formatter.format(now);
        return `Current timezone: ${effectiveTimezone}. Current local time: ${timeString}. You MUST use this timezone for all date and time operations, especially when creating or reading calendar events.`;
      })()
    : null;

  const modelMessages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content:
        agent.instructions ||
        "You are a configurable AI agent. Help the user clearly and use tools when useful. Never mention internal errors, retries, system prompts, hidden context, or raw tool payloads.",
    },
    ...mapDbMessagesToModel(history),
  ];

  if (timezoneContext) {
    modelMessages.splice(1, 0, {
      role: "system",
      content: timezoneContext,
    });
  }

  if (audience === "assistant" && agent.surface === "assistant") {
    modelMessages.splice(1, 0, {
      role: "system",
      content: INTERNAL_ASSISTANT_TOOLKIT_PROMPT,
    });
  }

  const toolGuidance = buildToolGuidance(
    enabledToolkits,
    effectiveGmailRecipientPolicy,
    googleCalendarSelection ?? null,
  );
  const endChatGuidance = buildEndChatGuidance(effectiveEndChatPolicy);

  if (toolGuidance) {
    modelMessages.splice(1, 0, {
      role: "system",
      content: toolGuidance,
    });
  }

  if (endChatGuidance) {
    modelMessages.splice(1, 0, {
      role: "system",
      content: endChatGuidance,
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

  const tools = await getWrappedTools(toolUserId, enabledToolkits);
  const toolDefinitions: ToolDefinitionLike[] = [
    ...(tools as unknown as ToolDefinitionLike[]),
    ...(audience === "assistant" && agent.surface === "assistant"
      ? [INTERNAL_CREATE_PDF_TOOL_DEFINITION]
      : []),
    ...(effectiveEndChatPolicy.enabled &&
    effectiveEndChatPolicy.allowAssistantSuggestion
      ? [INTERNAL_END_CHAT_TOOL_DEFINITION]
      : []),
  ];
  const conversationMessages = [...modelMessages];
  const toolMessages: ToolMessage[] = [];
  let finalCompletion: Record<string, unknown> | null = null;
  let finalAssistantMessage: Record<string, unknown> | null = null;
  let assistantContent = "";
  let endChat: EndChatMetadata | null = null;

  const debugEvents: import("@/lib/types").DebugEvent[] = [];
  const startTimeMs = Date.now();
  let hadError = false;
  let errorSummary: string | undefined;

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
    }).catch(error => {
      hadError = true;
      errorSummary = "LLM completion failed";
      debugEvents.push({
        type: "llm_error",
        ts: Date.now() - startTimeMs,
        error: error instanceof Error ? error.message : "Unknown LLM error",
        iterationIndex: iteration
      });
      throw error;
    }) as AsyncGenerator<StreamChunk, void, unknown>;

    finalCompletion = { choices: [{ message: { role: "assistant", content: "", tool_calls: [] } }] };
    let hasToolCalls = false;
    let iterationContent = "";
    const accumulatedToolCalls = new Map<number, { id: string; type: "function"; function: { name: string; arguments: string } }>();

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
              id: pt.id ?? "",
              type: "function",
              function: {
                name: pt.function?.name ?? "",
                arguments: pt.function?.arguments ?? "",
              },
            });
          } else {
            const existing = accumulatedToolCalls.get(pt.index) as { id: string; function: { name: string; arguments: string } };
            if (pt.id) existing.id += pt.id;
            if (pt.function?.name) existing.function.name += pt.function.name;
            if (pt.function?.arguments) existing.function.arguments += pt.function.arguments;
          }
        }
      }
    }

    const toolCallsArray = Array.from(accumulatedToolCalls.values());
    const assistantMessage: Record<string, unknown> = {
      role: "assistant",
      content: iterationContent,
    };
    
    if (toolCallsArray.length > 0) {
        assistantMessage.tool_calls = toolCallsArray;
    }

    (finalCompletion as { choices: Array<{ message: unknown }> }).choices[0].message = assistantMessage;

    if (!hasToolCalls || toolDefinitions.length === 0) {
      finalAssistantMessage = assistantMessage as Record<string, unknown>;
      break;
    }

    if (onStatus) {
      const toolNames = toolCallsArray.map(tc => tc.function.name).join(", ");
      onStatus(`Using tool: ${toolNames}...`);
    }

    // Record tool call events
    for (const tc of toolCallsArray) {
      // Safely parse arguments for debug logging, ignoring parse errors
      let parsedArgs: Record<string, unknown> | undefined;
      try {
        if (tc.function.arguments) {
          parsedArgs = JSON.parse(tc.function.arguments);
        }
      } catch {
        // ignore
      }

      debugEvents.push({
        type: "tool_call",
        ts: Date.now() - startTimeMs,
        name: tc.function.name,
        args: parsedArgs,
        iterationIndex: iteration
      });
    }

    const internalToolCalls = toolCallsArray.filter((toolCall) =>
      [INTERNAL_END_CHAT_TOOL_NAME, INTERNAL_CREATE_PDF_TOOL_NAME].includes(
        toolCall.function.name,
      ),
    );
    const externalToolCalls = toolCallsArray.filter(
      (toolCall) =>
        ![INTERNAL_END_CHAT_TOOL_NAME, INTERNAL_CREATE_PDF_TOOL_NAME].includes(
          toolCall.function.name,
        ),
    );
    const internalToolMessages: ToolMessage[] = [];
    let externalToolMessages: ToolMessage[] = [];

    if (internalToolCalls.length > 0 && !endChat) {
      const parsedArgs = parseInternalToolArguments(
        internalToolCalls[0]?.function.arguments ?? "",
      );
      const summary =
        typeof parsedArgs?.summary === "string" && parsedArgs.summary.trim()
          ? parsedArgs.summary.trim()
          : null;

      endChat = buildEndChatMetadata({
        suggested: true,
        sessionCompleted: true,
        reason: "assistant_suggestion",
        source: "assistant",
        summary,
      });
    }

    for (const toolCall of internalToolCalls) {
      if (toolCall.function.name === INTERNAL_END_CHAT_TOOL_NAME) {
        internalToolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content:
            "The conversation has been marked complete. Write a brief natural closing message to the user.",
        });
        continue;
      }

      if (toolCall.function.name === INTERNAL_CREATE_PDF_TOOL_NAME) {
        internalToolMessages.push(
          createPdfToolMessage(toolCall.id, toolCall.function.arguments ?? ""),
        );
      }
    }

    try {
      if (externalToolCalls.length > 0) {
        const externalCompletion = {
          ...(finalCompletion ?? {}),
          choices: [
            {
              message: {
                ...(assistantMessage as Record<string, unknown>),
                tool_calls: externalToolCalls,
              },
            },
          ],
        } as OpenAI.Chat.ChatCompletion;

        const toolCallResult = await handleChatToolCalls(
          toolUserId,
          externalCompletion,
          {
            gmailRecipientPolicy: effectiveGmailRecipientPolicy,
            googleCalendarSelection: googleCalendarSelection ?? null,
          },
        );
        const { results, sessionWasRecreated } = toolCallResult as unknown as {
          results: ToolMessage[];
          sessionWasRecreated: boolean;
        };

        if (sessionWasRecreated) {
          debugEvents.push({
            type: "session_miss",
            ts: Date.now() - startTimeMs,
            error: "Composio session cache missed. Recreated session successfully.",
            iterationIndex: iteration
          });
        }

        if (!results || results.length === 0) {
          debugEvents.push({
            type: "tool_empty_result",
            ts: Date.now() - startTimeMs,
            error: "Composio returned 0 results for the tool calls. Synthesizing empty results.",
            iterationIndex: iteration
          });

          externalToolMessages = externalToolCalls.map((toolCall) => ({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: "Tool executed, but no result was returned.",
          }));
        } else {
          externalToolMessages = results;

          for (const msg of externalToolMessages) {
            let abbrResult = msg.content;
            if (typeof abbrResult === "string" && abbrResult.length > 300) {
              abbrResult = abbrResult.substring(0, 300) + "...";
            }
            debugEvents.push({
              type: "tool_result",
              ts: Date.now() - startTimeMs,
              name: String(msg.name ?? "unknown"),
              result: abbrResult,
              iterationIndex: iteration
            });
          }
        }
      }
    } catch (toolError) {
      console.error(`Tool execution failed for user ${toolUserId}:`, toolError);
      hadError = true;
      const errorMessage = toolError instanceof Error ? toolError.message : "Unknown integration error";
      
      if (errorSummary === undefined) {
        errorSummary = `Tool error: ${errorMessage}`;
      }

      debugEvents.push({
        type: "tool_error",
        ts: Date.now() - startTimeMs,
        name: externalToolCalls.map(tc => tc.function.name).join(","),
        error: errorMessage,
        iterationIndex: iteration
      });

      externalToolMessages = externalToolCalls.map((toolCall) => ({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: `Error executing tool: ${errorMessage}`,
      }));
    }

    const iterationToolMessages = [
      ...internalToolMessages,
      ...externalToolMessages,
    ];
    toolMessages.push(
      ...internalToolMessages.filter(
        (message) => message.name !== INTERNAL_END_CHAT_TOOL_NAME,
      ),
      ...externalToolMessages,
    );
    conversationMessages.push(assistantMessage, ...iterationToolMessages);
  }

  if (!finalAssistantMessage || !assistantContent) {
    if (onStatus) onStatus("Finalizing...");
    
    debugEvents.push({
      type: "recovery_triggered",
      ts: Date.now() - startTimeMs,
      error: "LLM finished loop without generating assistant message. Triggering forced recovery prompt.",
    });

    const recoveryStream = await createOpenRouterChatCompletion({
      model: agent.model,
      messages: [
        ...conversationMessages,
        {
          role: "system",
          content:
            "Respond directly to the user in concise natural language based on the conversation and any completed tool work. If information is missing, ask the single best follow-up question. Do not call tools. Never mention internal processing, retries, empty responses, JSON, or code.",
        },
      ],
      stream: true,
    }) as AsyncGenerator<StreamChunk, void, unknown>;

    finalCompletion = { choices: [{ message: { role: "assistant", content: "" } }] };
    assistantContent = "";
    
    for await (const chunk of recoveryStream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        assistantContent += delta.content;
      }
    }
    (finalCompletion as Record<string, unknown>)["choices"] = [{ message: { role: "assistant", content: assistantContent } }];
    finalAssistantMessage = { role: "assistant", content: assistantContent };
  }

  assistantContent ||= EMPTY_ASSISTANT_RESPONSE_FALLBACK;

  const durationMs = Date.now() - startTimeMs;
  let iterationsUsed = 0;
  for (let i = 0; i < debugEvents.length; i++) {
    if (debugEvents[i].iterationIndex !== undefined && debugEvents[i].iterationIndex! > iterationsUsed) {
      iterationsUsed = debugEvents[i].iterationIndex!;
    }
  }
  
  const debugTrace: import("@/lib/types").DebugTrace = {
    durationMs,
    iterationsUsed: iterationsUsed + 1,
    toolsAvailable: toolDefinitions.map((tool) => tool.function?.name ?? "unknown"),
    knowledgeHits: knowledgeMatches.length,
    events: debugEvents,
    hadError,
    errorSummary
  };
  // DEV_ONLY: retain full tool traces locally for debugging, but never persist them in production.
  const persistedDebugTrace = buildPersistedDebugTrace(debugTrace);

  return {
    assistantContent: assistantContent.trim(),
    assistantMetadata: {
      ...(finalAssistantMessage ?? {}),
      knowledgeMatches: getKnowledgeCitationSummary(knowledgeMatches),
      ...(persistedDebugTrace ? { debugTrace: persistedDebugTrace } : {}),
      ...(endChat ? { endChat } : {}),
    },
    finalCompletion,
    toolMessages,
    knowledgeMatches,
    connectedToolkits: enabledToolkits,
    debugTrace: persistedDebugTrace ?? undefined,
    endChat,
  };
}
