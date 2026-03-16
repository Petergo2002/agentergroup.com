import { Composio } from "@composio/core";
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

const SESSION_TTL_MS = 1000 * 60 * 30;
const toolRouterSessionCache = new Map<string, ToolRouterSessionRef>();

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

export function createComposioClient() {
  if (!hasComposioEnv()) {
    return null;
  }

  return new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
  });
}

export async function getOrCreateToolRouterSession(userId: string) {
  const cached = toolRouterSessionCache.get(userId);

  if (cached && Date.now() - cached.createdAt < SESSION_TTL_MS) {
    return cached;
  }

  const composio = createComposioClient();

  if (!composio) {
    return null;
  }

  const session = await composio.experimental.toolRouter.createSession(userId, {
    manuallyManageConnections: true,
    toolkits: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  });

  const nextValue = {
    sessionId: session.sessionId,
    url: session.url,
    createdAt: Date.now(),
  };

  toolRouterSessionCache.set(userId, nextValue);
  return nextValue;
}

export async function listConnectedAccounts(userId: string) {
  const composio = createComposioClient();

  if (!composio) {
    return [];
  }

  const session = await getOrCreateToolRouterSession(userId);
  const response = await composio.connectedAccounts.list({
    userIds: [userId],
    toolkitSlugs: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  });

  const items = (Array.isArray(response?.items)
    ? response.items
    : []) as unknown as ComposioConnectedAccountItem[];

  return items
    .map((item) => normalizeConnectedAccount(item, session))
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

  const session = await getOrCreateToolRouterSession(userId);
  const request = await composio.toolkits.authorize(userId, integration.slug);

  return {
    id: request.id,
    redirectUrl: request.redirectUrl,
    session,
  };
}

export async function getWrappedTools(userId: string, toolkitSlugs: string[]) {
  const composio = createComposioClient();

  if (!composio) {
    return [];
  }

  const allowedTools = getAllowedChatToolsForToolkits(toolkitSlugs);

  if (allowedTools.length === 0) {
    return [];
  }

  return composio.tools.get(userId, {
    tools: allowedTools,
  });
}

export async function handleChatToolCalls(
  userId: string,
  chatCompletion: OpenAI.Chat.ChatCompletion,
) {
  const composio = createComposioClient();

  if (!composio) {
    return [];
  }

  return composio.provider.handleToolCalls(userId, chatCompletion);
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
