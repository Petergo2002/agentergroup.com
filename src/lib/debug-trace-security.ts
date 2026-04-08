import type {
  DashboardConversationDetailResponse,
  DebugTrace,
  WorkspaceMemberRecord,
} from "./types";

type WorkspaceRole = WorkspaceMemberRecord["role"];

export interface PersistableToolMessage {
  content?: string;
  name?: string | null;
  role?: string;
  tool_call_id?: string | null;
  [key: string]: unknown;
}

export interface PersistedRunOutput {
  finalCompletion: Record<string, unknown> | null;
  toolMessages: PersistableToolMessage[];
  knowledgeMatches: unknown[];
}

function isProductionEnvironment(env = process.env.NODE_ENV) {
  return env === "production";
}

function buildRedactedToolContent(name: string | null) {
  if (name === "create_pdf_from_text") {
    return "A PDF was prepared during this conversation. Raw tool payloads are not stored in production.";
  }

  if (name) {
    return `Tool ${name} executed. Raw tool payloads are not stored in production.`;
  }

  return "Tool executed. Raw tool payloads are not stored in production.";
}

export function buildPersistedDebugTrace(
  debugTrace: DebugTrace | null | undefined,
  env = process.env.NODE_ENV,
) {
  if (!debugTrace || isProductionEnvironment(env)) {
    return null;
  }

  return debugTrace;
}

export function buildPersistedAssistantMetadata(
  metadata: Record<string, unknown>,
  env = process.env.NODE_ENV,
) {
  if (!isProductionEnvironment(env)) {
    return metadata;
  }

  const sanitizedMetadata = { ...metadata };
  delete sanitizedMetadata.debugTrace;
  return sanitizedMetadata;
}

export function buildPersistedToolMessages(
  toolMessages: PersistableToolMessage[],
  env = process.env.NODE_ENV,
) {
  if (!isProductionEnvironment(env)) {
    return toolMessages;
  }

  return toolMessages.map((message) => {
    const name = typeof message.name === "string" ? message.name : null;

    return {
      role: "tool",
      tool_call_id:
        typeof message.tool_call_id === "string" ? message.tool_call_id : null,
      name,
      content: buildRedactedToolContent(name),
    } satisfies PersistableToolMessage;
  });
}

export function buildPersistedRunOutput(
  output: PersistedRunOutput,
  env = process.env.NODE_ENV,
) {
  if (!isProductionEnvironment(env)) {
    return output;
  }

  return {
    finalCompletion: null,
    toolMessages: buildPersistedToolMessages(output.toolMessages, env),
    knowledgeMatches: output.knowledgeMatches,
  } satisfies PersistedRunOutput;
}

export function canViewDebugTrace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function buildConversationDetailForViewer(
  detail: DashboardConversationDetailResponse,
  role: WorkspaceRole,
) {
  if (canViewDebugTrace(role)) {
    return detail;
  }

  return {
    ...detail,
    transcript: detail.transcript.map((message) => ({
      ...message,
      debugTrace: null,
    })),
  } satisfies DashboardConversationDetailResponse;
}
