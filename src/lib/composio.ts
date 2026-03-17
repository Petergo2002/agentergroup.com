import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import type OpenAI from "openai";
import { hasComposioEnv } from "@/lib/env";
import type { DriveImportFileRecord } from "@/lib/types";
import {
  getDriveImportMimeTypes,
  getAllowedChatToolsForToolkits,
  getSupportedIntegration,
  isSupportedIntegrationSlug,
  SUPPORTED_INTEGRATIONS,
  type SupportedIntegrationSlug,
} from "@/lib/integrations";

interface ComposioToolkitRef {
  slug?: string;
  name?: string;
}

interface ComposioAuthConfigRef {
  id?: string;
  name?: string;
}

interface ComposioConnectedAccountItem {
  id?: string;
  nanoid?: string;
  connectedAccountId?: string;
  toolkit?: ComposioToolkitRef;
  toolkitSlug?: string;
  appName?: string;
  status?: string;
  accountName?: string;
  connectionName?: string;
  authConfig?: ComposioAuthConfigRef;
  [key: string]: unknown;
}

interface ToolRouterSessionRef {
  sessionId: string;
  url: string;
  createdAt: number;
}

export interface SyncedConnectedAccount {
  externalId: string | null;
  toolkitSlug: SupportedIntegrationSlug;
  displayName: string;
  status: "pending" | "connected" | "error" | "disconnected";
  accountLabel: string;
  authConfigId: string | null;
  toolkitData: Record<string, unknown>;
}

interface MCPSessionInfo {
  url: string;
  headers: Record<string, string>;
}

const SESSION_TTL_MS = 1000 * 60 * 30;
const toolRouterSessionCache = new Map<string, ToolRouterSessionRef>();
const composioSessionCache = new Map<string, Awaited<ReturnType<Composio["create"]>>>();
const MCP_SESSION_CACHE = new Map<string, MCPSessionInfo>();

function normalizeConnectionStatus(value?: string | null) {
  const status = (value ?? "").toUpperCase();

  if (["ACTIVE", "CONNECTED", "ENABLED"].includes(status)) {
    return "connected" as const;
  }

  if (["INITIATED", "PENDING", "IN_PROGRESS"].includes(status)) {
    return "pending" as const;
  }

  if (["DISABLED", "EXPIRED", "DELETED"].includes(status)) {
    return "disconnected" as const;
  }

  if (status) {
    return "error" as const;
  }

  return "pending" as const;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function buildDriveSearchQuery(search: string) {
  const baseQuery = "trashed = false";

  if (!search.trim()) {
    return baseQuery;
  }

  const escapedSearch = search.replace(/'/g, "");
  return `${baseQuery} and name contains '${escapedSearch}'`;
}

function createDriveFileRecord(item: Record<string, unknown>): DriveImportFileRecord | null {
  const id = pickString(item.id) ?? pickString(item.fileId);
  const name = pickString(item.name) ?? pickString(item.title);
  const mimeType = pickString(item.mimeType) ?? pickString(item.mime_type);

  if (!id || !name || !mimeType) {
    return null;
  }

  return {
    id,
    name,
    mimeType,
    modifiedTime:
      pickString(item.modifiedTime) ??
      pickString(item.modified_time) ??
      pickString(item.modifiedAt),
    webViewLink:
      pickString(item.webViewLink) ??
      pickString(item.web_view_link) ??
      pickString(item.alternateLink),
    size:
      pickString(item.size) ??
      (typeof item.size === "number" ? String(item.size) : null),
  };
}

function extractDriveFileArray(data: Record<string, unknown>) {
  const supportedMimeTypes = new Set<string>(getDriveImportMimeTypes());
  const buckets = [
    data.files,
    data.items,
    data.results,
    data.documents,
    data,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    const files = bucket
      .map((item) =>
        typeof item === "object" && item !== null
          ? createDriveFileRecord(item as Record<string, unknown>)
          : null,
      )
      .filter(
        (file): file is DriveImportFileRecord =>
          Boolean(file && supportedMimeTypes.has(file.mimeType)),
      );

    if (files.length > 0) {
      return files;
    }
  }

  return [];
}

function normalizeConnectedAccount(
  item: ComposioConnectedAccountItem,
  session: ToolRouterSessionRef | null,
): SyncedConnectedAccount | null {
  const toolkitSlugCandidate =
    item.toolkit?.slug ??
    item.toolkitSlug ??
    item.toolkit?.name?.toLowerCase?.() ??
    null;

  if (!toolkitSlugCandidate || !isSupportedIntegrationSlug(toolkitSlugCandidate)) {
    return null;
  }

  const integration = getSupportedIntegration(toolkitSlugCandidate);

  if (!integration) {
    return null;
  }

  return {
    externalId: item.id ?? item.nanoid ?? item.connectedAccountId ?? null,
    toolkitSlug: toolkitSlugCandidate,
    displayName: integration.displayName,
    status: normalizeConnectionStatus(item.status),
    accountLabel:
      item.accountName ??
      item.connectionName ??
      item.authConfig?.name ??
      "default",
    authConfigId: item.authConfig?.id ?? null,
    toolkitData: {
      ...item,
      toolRouterSessionId: session?.sessionId ?? null,
      toolRouterSessionUrl: session?.url ?? null,
    },
  };
}

let composioClient: Composio | null = null;

export function createComposioClient() {
  if (!hasComposioEnv()) {
    return null;
  }

  if (!composioClient) {
    composioClient = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
    });
  }

  return composioClient;
}

export async function getOrCreateToolRouterSession(userId: string) {
  const cached = toolRouterSessionCache.get(userId);

  if (cached && Date.now() - cached.createdAt < SESSION_TTL_MS) {
    return cached;
  }

  const composio = createComposioClient();

  if (!composio) {
    console.error("[Composio] No composio client available");
    return null;
  }

  try {
    const session = await composio.create(userId, {
      toolkits: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
    });

    const nextValue = {
      sessionId: session.sessionId,
      url: session.mcp.url,
      createdAt: Date.now(),
    };

    toolRouterSessionCache.set(userId, nextValue);
    composioSessionCache.set(userId, session);

    console.log("[Composio] Created session for user:", userId, "Session ID:", session.sessionId);
    return nextValue;
  } catch (error) {
    console.error("[Composio] Failed to create session:", error);
    return null;
  }
}

export async function getComposioSession(userId: string) {
  const cached = composioSessionCache.get(userId);

  if (cached) {
    return cached;
  }

  const composio = createComposioClient();

  if (!composio) {
    return null;
  }

  const session = await composio.create(userId, {
    toolkits: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  });

  composioSessionCache.set(userId, session);
  return session;
}

export async function getMCPSession(userId: string) {
  const cacheKey = `${userId}`;
  const cached = MCP_SESSION_CACHE.get(cacheKey);

  if (cached) {
    return cached;
  }

  const session = await getComposioSession(userId);

  if (!session) {
    return null;
  }

  const mcpInfo = {
    url: session.mcp.url,
    headers: session.mcp.headers ?? {},
  };

  MCP_SESSION_CACHE.set(cacheKey, mcpInfo);
  return mcpInfo;
}

export async function listConnectedAccounts(userId: string) {
  const composio = createComposioClient();

  if (!composio) {
    return [];
  }

  const session = await getComposioSession(userId);
  const response = await composio.connectedAccounts.list({
    userIds: [userId],
    toolkitSlugs: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  });

  const items = (Array.isArray(response?.items)
    ? response.items
    : []) as unknown as ComposioConnectedAccountItem[];

  const toolRouterSession = toolRouterSessionCache.get(userId);

  return items
    .map((item) => normalizeConnectedAccount(item, toolRouterSession ?? null))
    .filter(Boolean) as SyncedConnectedAccount[];
}

export async function syncConnectedAccountsToDatabase(
  supabase: {
    from: (table: string) => {
      upsert: (values: unknown, options?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  },
  workspaceId: string,
  userId: string,
) {
  const connectedAccounts = await listConnectedAccounts(userId);

  if (connectedAccounts.length === 0) {
    return [];
  }

  const { error } = await supabase.from("connections").upsert(
    connectedAccounts.map((account) => ({
      workspace_id: workspaceId,
      provider: "composio",
      toolkit_slug: account.toolkitSlug,
      display_name: account.displayName,
      status: account.status,
      external_id: account.externalId,
      account_label: account.accountLabel ?? "default",
      toolkit_data: account.toolkitData,
      created_by: userId,
      last_synced_at: new Date().toISOString(),
    })),
    {
      onConflict: "workspace_id,toolkit_slug,account_label",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return connectedAccounts;
}

export async function createConnectionRequest(userId: string, toolkitSlug: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const integration = getSupportedIntegration(toolkitSlug);

  if (!integration) {
    throw new Error("Unsupported integration.");
  }

  const session = await getComposioSession(userId);
  
  const request = await composio.connectedAccounts.link(userId, toolkitSlug);

  return {
    id: request.id,
    redirectUrl: request.redirectUrl,
    session,
  };
}

export async function getWrappedTools(userId: string, toolkitSlugs: string[]) {
  const composio = createComposioClient();

  if (!composio) {
    console.error("[Composio] No composio client available in getWrappedTools");
    return [];
  }

  const allowedTools = getAllowedChatToolsForToolkits(toolkitSlugs);

  if (allowedTools.length === 0) {
    console.log("[Composio] No allowed tools for toolkits:", toolkitSlugs);
    return [];
  }

  try {
    const tools = await composio.tools.get(userId, {
      tools: allowedTools,
    });
    console.log("[Composio] Got tools for user:", userId, "Tools count:", allowedTools.length);
    return tools;
  } catch (error) {
    console.error("[Composio] Failed to get tools:", error);
    return [];
  }
}

export async function handleChatToolCalls(
  userId: string,
  chatCompletion: OpenAI.Chat.ChatCompletion,
) {
  const composio = createComposioClient();

  if (!composio) {
    console.error("[Composio] No composio client available in handleChatToolCalls");
    return [];
  }

  const session = await getComposioSession(userId);

  if (!session) {
    console.error("[Composio] No session available in handleChatToolCalls for user:", userId);
    return [];
  }

  if (!composio.provider) {
    console.error("[Composio] No provider available in handleChatToolCalls");
    return [];
  }

  try {
    const toolCalls = chatCompletion.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const toolNames = toolCalls.map(tc => "function" in tc ? (tc.function?.name ?? "unknown") : ("name" in tc ? tc.name : "unknown")).join(", ");
      console.log("[Composio] Handling tool calls for user:", userId, "Tool calls:", toolNames);
    }
    
    const results = await composio.provider.handleToolCalls(userId, chatCompletion);
    
    if (results && results.length > 0) {
      console.log("[Composio] Tool call results:", results.length);
    }
    
    return results;
  } catch (error) {
    console.error("[Composio] Failed to handle tool calls:", error);
    return [];
  }
}

export async function executeToolCall(
  userId: string,
  toolName: string,
  arguments_: Record<string, unknown>,
) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const result = await composio.tools.execute(toolName, {
    userId,
    arguments: arguments_,
  });

  if (!result.successful) {
    throw new Error(result.error ?? `Failed to execute tool: ${toolName}`);
  }

  return result.data;
}

export async function listDriveImportFiles(
  userId: string,
  search = "",
  pageToken?: string,
) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const result = await composio.tools.execute("GOOGLEDRIVE_FIND_FILE", {
    userId,
    arguments: {
      q: buildDriveSearchQuery(search),
      corpora: "user",
      pageSize: 20,
      pageToken,
    },
  });

  if (!result.successful) {
    throw new Error(result.error ?? "Failed to list Google Drive files.");
  }

  const files = extractDriveFileArray(result.data);
  const nextPageToken = pickString(result.data.nextPageToken) ?? pickString(result.data.pageToken);

  return {
    files,
    nextPageToken,
    raw: result.data,
  };
}

export async function getDriveFileMetadata(userId: string, fileId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const result = await composio.tools.execute("GOOGLEDRIVE_GET_FILE_METADATA", {
    userId,
    arguments: {
      fileId,
    },
  });

  if (!result.successful) {
    throw new Error(result.error ?? "Failed to load Google Drive file metadata.");
  }

  const record =
    createDriveFileRecord(result.data) ??
    createDriveFileRecord(
      (typeof result.data.file === "object" && result.data.file !== null
        ? result.data.file
        : {}) as Record<string, unknown>,
    );

  if (!record) {
    throw new Error("Google Drive metadata response was incomplete.");
  }

  return {
    ...record,
    webViewLink: record.webViewLink ?? pickString(result.data.webViewLink),
    raw: result.data,
  };
}

export async function downloadDriveFile(userId: string, fileId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const result = await composio.tools.execute("GOOGLEDRIVE_DOWNLOAD_FILE", {
    userId,
    arguments: {
      file_id: fileId,
    },
  });

  if (!result.successful) {
    throw new Error(result.error ?? "Failed to download Google Drive file.");
  }

  return result.data;
}
