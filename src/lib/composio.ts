import { Composio } from "@composio/core";
import type OpenAI from "openai";
import {
  buildWorkspaceComposioUserId,
  getConnectionComposioUserId,
} from "@/lib/connections";
import { getComposioWebhookSecret, hasComposioEnv } from "@/lib/env";
import { normalizeGmailRecipientEmail } from "@/lib/gmail";
import { extractGoogleCalendarListItems } from "@/lib/google-calendar";
import type {
  CalSelection,
  DriveImportFileRecord,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
} from "@/lib/types";
import {
  getDriveImportMimeTypes,
  getRecommendedChatToolsForToolkit,
  getInternalAssistantToolkitSlugs,
  getSupportedIntegration,
  isInternalAssistantToolkitSlug,
  isSupportedIntegrationSlug,
  isToolNameForToolkit,
  SUPPORTED_INTEGRATIONS,
  type SupportedIntegrationSlug,
} from "@/lib/integrations";
import type { EnabledToolSelection } from "@/lib/tool-actions";

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

export interface ToolkitActionOption {
  name: string;
  description: string;
  recommended: boolean;
}

export interface ComposioTriggerConnectionRef {
  external_id: string | null;
  toolkit_data: Record<string, unknown> | null;
}

export interface CreateComposioTriggerInput {
  workspaceId: string;
  connection: ComposioTriggerConnectionRef;
  triggerSlug: string;
  triggerConfig: Record<string, unknown>;
}

interface ConnectionSyncRow {
  id: string;
  external_id: string | null;
  status: string;
  toolkit_data: Record<string, unknown>;
  last_synced_at: string | null;
}

interface ConnectionSyncSupabaseTable {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: ConnectionSyncRow | null;
          error: { message: string } | null;
        }>;
        in: (
          column: string,
          values: string[],
        ) => Promise<{
          data: ConnectionSyncRow[] | null;
          error: { message: string } | null;
        }>;
      };
      in: (
        column: string,
        values: string[],
      ) => Promise<{
        data: ConnectionSyncRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{ error: { message: string } | null }>;
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  insert: (
    values: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  upsert: (
    values: unknown,
    options?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
}

const GMAIL_SEND_EMAIL_TOOL = "GMAIL_SEND_EMAIL";
const OUTLOOK_SEND_EMAIL_TOOL = "OUTLOOK_SEND_EMAIL";
const GOOGLE_CALENDAR_CREATE_EVENT_TOOL = "GOOGLECALENDAR_CREATE_EVENT";
const GOOGLE_CALENDAR_QUICK_ADD_TOOL = "GOOGLECALENDAR_QUICK_ADD";
const GOOGLE_CALENDAR_FIND_FREE_SLOTS_TOOL = "GOOGLECALENDAR_FIND_FREE_SLOTS";
const GOOGLE_CALENDAR_FREE_BUSY_QUERY_TOOL = "GOOGLECALENDAR_FREE_BUSY_QUERY";
const CAL_GET_AVAILABLE_SLOTS_INFO_TOOL = "CAL_GET_AVAILABLE_SLOTS_INFO";
const CAL_CREATE_BOOKING_VERSION_2_TOOL = "CAL_CREATE_BOOKING_VERSION_2";

const DEFAULT_COMPOSIO_TOOLKIT_VERSIONS = {
  gmail: process.env.COMPOSIO_TOOLKIT_VERSION_GMAIL ?? "20260307_00",
  googlecalendar: process.env.COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR ?? "20260309_00",
  cal: process.env.COMPOSIO_TOOLKIT_VERSION_CAL ?? "latest",
  googledrive: process.env.COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE ?? "20260309_00",
  outlook: process.env.COMPOSIO_TOOLKIT_VERSION_OUTLOOK ?? "latest",
  text_to_pdf: process.env.COMPOSIO_TOOLKIT_VERSION_TEXT_TO_PDF ?? "latest",
} as const;

const SESSION_TTL_MS = 1000 * 60 * 30;
const toolRouterSessionCache = new Map<string, ToolRouterSessionRef>();
const composioSessionCache = new Map<string, Awaited<ReturnType<Composio["create"]>>>();
const MCP_SESSION_CACHE = new Map<string, MCPSessionInfo>();
const COMPOSIO_SESSION_TOOLKITS = [
  ...SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  ...getInternalAssistantToolkitSlugs(),
];
const CONNECTION_STATUS_PRIORITY: Record<SyncedConnectedAccount["status"], number> = {
  connected: 4,
  pending: 3,
  error: 2,
  disconnected: 1,
};

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

export function getComposioConnectedAccountId(
  connection: ComposioTriggerConnectionRef,
) {
  return (
    connection.external_id ??
    pickString(connection.toolkit_data?.id) ??
    pickString(connection.toolkit_data?.connectedAccountId)
  );
}

function normalizeAccountLabel(label: string | null | undefined) {
  return label?.trim() || "default";
}

function preferConnectedAccount(
  current: SyncedConnectedAccount,
  next: SyncedConnectedAccount,
) {
  const currentPriority = CONNECTION_STATUS_PRIORITY[current.status] ?? 0;
  const nextPriority = CONNECTION_STATUS_PRIORITY[next.status] ?? 0;

  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority;
  }

  const currentHasRouterSession = Boolean(current.toolkitData.toolRouterSessionId);
  const nextHasRouterSession = Boolean(next.toolkitData.toolRouterSessionId);

  if (nextHasRouterSession !== currentHasRouterSession) {
    return nextHasRouterSession;
  }

  const currentPayloadSize = Object.keys(current.toolkitData).length;
  const nextPayloadSize = Object.keys(next.toolkitData).length;

  return nextPayloadSize > currentPayloadSize;
}

function buildUniqueAccountLabel(
  account: SyncedConnectedAccount,
  usedLabels: Set<string>,
) {
  const baseLabel = normalizeAccountLabel(account.accountLabel);
  const baseKey = `${account.toolkitSlug}::${baseLabel.toLowerCase()}`;

  if (!usedLabels.has(baseKey)) {
    usedLabels.add(baseKey);
    return baseLabel;
  }

  const externalSuffix = account.externalId?.slice(-6);
  if (externalSuffix) {
    const candidate = `${baseLabel} · ${externalSuffix}`;
    const candidateKey = `${account.toolkitSlug}::${candidate.toLowerCase()}`;

    if (!usedLabels.has(candidateKey)) {
      usedLabels.add(candidateKey);
      return candidate;
    }
  }

  let attempt = 2;
  while (attempt < 100) {
    const candidate = `${baseLabel} (${attempt})`;
    const candidateKey = `${account.toolkitSlug}::${candidate.toLowerCase()}`;

    if (!usedLabels.has(candidateKey)) {
      usedLabels.add(candidateKey);
      return candidate;
    }

    attempt += 1;
  }

  return `${baseLabel} (${Date.now()})`;
}

function prepareAccountsForSync(accounts: SyncedConnectedAccount[]) {
  const dedupedByIdentity = new Map<string, SyncedConnectedAccount>();

  for (const account of accounts) {
    const identityKey = account.externalId
      ? `${account.toolkitSlug}::${account.externalId}`
      : `${account.toolkitSlug}::${normalizeAccountLabel(account.accountLabel).toLowerCase()}`;
    const existing = dedupedByIdentity.get(identityKey);

    if (!existing || preferConnectedAccount(existing, account)) {
      dedupedByIdentity.set(identityKey, account);
    }
  }

  const usedLabels = new Set<string>();

  return Array.from(dedupedByIdentity.values())
    .sort((left, right) => {
      if (left.toolkitSlug !== right.toolkitSlug) {
        return left.toolkitSlug.localeCompare(right.toolkitSlug);
      }

      const priorityDelta =
        (CONNECTION_STATUS_PRIORITY[right.status] ?? 0) -
        (CONNECTION_STATUS_PRIORITY[left.status] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const labelCompare = normalizeAccountLabel(left.accountLabel).localeCompare(
        normalizeAccountLabel(right.accountLabel),
      );
      if (labelCompare !== 0) {
        return labelCompare;
      }

      return (left.externalId ?? "").localeCompare(right.externalId ?? "");
    })
    .map((account) => ({
      ...account,
      accountLabel: buildUniqueAccountLabel(account, usedLabels),
    }));
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
  composioUserId: string,
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
      composioUserId,
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
      toolkitVersions: DEFAULT_COMPOSIO_TOOLKIT_VERSIONS,
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
      toolkits: COMPOSIO_SESSION_TOOLKITS,
    });

    const nextValue = {
      sessionId: session.sessionId,
      url: session.mcp.url,
      createdAt: Date.now(),
    };

    toolRouterSessionCache.set(userId, nextValue);
    composioSessionCache.set(userId, session);
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
    toolkits: COMPOSIO_SESSION_TOOLKITS,
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

export async function listConnectedAccounts(composioUserId: string) {
  const composio = createComposioClient();

  if (!composio) {
    return [];
  }

  await getComposioSession(composioUserId);
  const response = await composio.connectedAccounts.list({
    userIds: [composioUserId],
    toolkitSlugs: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
  });

  const items = (Array.isArray(response?.items)
    ? response.items
    : []) as unknown as ComposioConnectedAccountItem[];

  const toolRouterSession = toolRouterSessionCache.get(composioUserId);

  const normalizedAccounts = items
    .map((item) =>
      normalizeConnectedAccount(
        item,
        toolRouterSession ?? null,
        composioUserId,
      ),
    )
    .filter(Boolean) as SyncedConnectedAccount[];

  return prepareAccountsForSync(normalizedAccounts);
}

export async function syncConnectedAccountsToDatabase(
  supabase: { from: (table: string) => unknown },
  workspaceId: string,
  userId: string,
) {
  if (!createComposioClient()) {
    return [];
  }

  const composioUserId = buildWorkspaceComposioUserId(workspaceId);
  const connectedAccounts = await listConnectedAccounts(composioUserId);
  const syncTimestamp = new Date().toISOString();
  const connectedExternalIds = new Set(
    connectedAccounts
      .map((account) => account.externalId)
      .filter((externalId): externalId is string => Boolean(externalId)),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectionsTable = supabase.from("connections") as any;
  const { data: existingConnections, error: existingConnectionsError } = await connectionsTable
    .select("id, external_id, status, toolkit_data, last_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "composio");

  if (existingConnectionsError) {
    throw new Error(existingConnectionsError.message);
  }

  const staleConnectionIds = ((existingConnections ?? []) as ConnectionSyncRow[])
    .filter(
      (connection) =>
        getConnectionComposioUserId(connection) === composioUserId &&
        Boolean(connection.last_synced_at) &&
        Boolean(connection.external_id) &&
        !connectedExternalIds.has(connection.external_id as string) &&
        connection.status !== "disconnected",
    )
    .map((connection) => connection.id);

  if (staleConnectionIds.length > 0) {
    const { error: staleConnectionError } = await connectionsTable
      .update({
        status: "disconnected",
        last_synced_at: syncTimestamp,
      })
      .eq("workspace_id", workspaceId)
      .in("id", staleConnectionIds);

    if (staleConnectionError) {
      throw new Error(staleConnectionError.message);
    }
  }

  if (connectedAccounts.length === 0) {
    return [];
  }

  // Upsert each connected account individually using external_id as the
  // conflict key. This is the Composio connection ID — always unique — and
  // does not depend on any multi-column unique constraint on the table.
  for (const account of connectedAccounts) {
    const row = {
      workspace_id: workspaceId,
      provider: "composio",
      toolkit_slug: account.toolkitSlug,
      display_name: account.displayName,
      status: account.status,
      external_id: account.externalId,
      account_label: account.accountLabel ?? "default",
      toolkit_data: account.toolkitData,
      created_by: userId,
      last_synced_at: syncTimestamp,
    };

    if (account.externalId) {
      // Try to update the existing row by external_id first.
      const { data: existing } = await connectionsTable
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_id", account.externalId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await connectionsTable
          .update({
            display_name: row.display_name,
            status: row.status,
            account_label: row.account_label,
            toolkit_data: row.toolkit_data,
            last_synced_at: row.last_synced_at,
          })
          .eq("id", (existing as { id: string }).id);

        if (updateError) {
          throw new Error(updateError.message);
        }
        continue;
      }
    }

    // No existing row — insert fresh.
    const { error: insertError } = await connectionsTable.insert(row);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return connectedAccounts;
}

export async function createConnectionRequest(
  workspaceId: string,
  userId: string,
  toolkitSlug: string,
) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const integration = getSupportedIntegration(toolkitSlug);

  if (!integration) {
    throw new Error("Unsupported integration.");
  }

  const composioUserId = buildWorkspaceComposioUserId(workspaceId);
  const session = await getComposioSession(composioUserId);
  const authConfig = await composio.authConfigs.create(toolkitSlug, {
    name: `${integration.displayName} Managed Auth`,
    type: "use_composio_managed_auth",
  });
  const authConfigId =
    authConfig && typeof authConfig === "object" && "id" in authConfig
      ? String(authConfig.id)
      : null;

  if (!authConfigId) {
    throw new Error("Failed to create a Composio auth config.");
  }

  const request = await composio.connectedAccounts.link(composioUserId, authConfigId);

  return {
    id: request.id,
    authConfigId,
    composioUserId,
    redirectUrl: request.redirectUrl,
    session,
  };
}

export async function deleteConnectedAccount(connectedAccountId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  return composio.connectedAccounts.delete(connectedAccountId);
}

export async function getComposioTriggerType(slug: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  return composio.triggers.getType(slug);
}

export async function createComposioTrigger({
  workspaceId,
  connection,
  triggerSlug,
  triggerConfig,
}: CreateComposioTriggerInput) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const connectedAccountId = getComposioConnectedAccountId(connection);

  if (!connectedAccountId) {
    throw new Error("The selected connection is missing a Composio connected account id.");
  }

  return composio.triggers.create(
    buildWorkspaceComposioUserId(workspaceId),
    triggerSlug,
    {
      connectedAccountId,
      triggerConfig,
    },
  );
}

export async function enableComposioTrigger(triggerId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  return composio.triggers.enable(triggerId);
}

export async function disableComposioTrigger(triggerId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  return composio.triggers.disable(triggerId);
}

export async function deleteComposioTrigger(triggerId: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  return composio.triggers.delete(triggerId);
}

export async function verifyComposioWebhook(
  rawBody: string,
  headers: Headers,
) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const signature = headers.get("webhook-signature");
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");

  if (!signature || !webhookId || !webhookTimestamp) {
    throw new Error("Missing Composio webhook verification headers.");
  }

  return composio.triggers.verifyWebhook({
    payload: rawBody,
    signature,
    id: webhookId,
    timestamp: webhookTimestamp,
    secret: getComposioWebhookSecret(),
  });
}

function getSelectedChatToolsForToolkits(
  toolkitSlugs: string[],
  enabledToolsByToolkit?: EnabledToolSelection | null,
) {
  return Array.from(
    new Set(
      toolkitSlugs.flatMap((toolkitSlug) => {
        const configuredTools = enabledToolsByToolkit?.[toolkitSlug];
        const candidates = Array.isArray(configuredTools)
          ? configuredTools
          : getRecommendedChatToolsForToolkit(toolkitSlug);

        return candidates.filter((toolName) =>
          isToolNameForToolkit(toolName, toolkitSlug),
        );
      }),
    ),
  );
}

function extractToolDefinitionName(tool: unknown) {
  if (!tool || typeof tool !== "object") {
    return null;
  }

  const record = tool as Record<string, unknown>;
  const directName = record.name;
  const functionValue = record.function;
  const functionName =
    functionValue && typeof functionValue === "object"
      ? (functionValue as Record<string, unknown>).name
      : null;

  return typeof functionName === "string"
    ? functionName
    : typeof directName === "string"
      ? directName
      : null;
}

function extractToolDefinitionDescription(tool: unknown) {
  if (!tool || typeof tool !== "object") {
    return "";
  }

  const record = tool as Record<string, unknown>;
  const directDescription = record.description;
  const functionValue = record.function;
  const functionDescription =
    functionValue && typeof functionValue === "object"
      ? (functionValue as Record<string, unknown>).description
      : null;

  return typeof functionDescription === "string"
    ? functionDescription
    : typeof directDescription === "string"
      ? directDescription
      : "";
}

export async function listToolkitChatActions(userId: string, toolkitSlug: string) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  // Fetch ALL tools for the toolkit.
  // IMPORTANT: Without `important: false`, the Composio SDK auto-applies an
  // "important=true" filter when querying by toolkit name — silently returning
  // only ~30 "highlighted" tools instead of all 301+ (e.g. Outlook).
  // We also set a high limit so pagination doesn't truncate the list.
  const tools = await composio.tools.get(userId, {
    toolkits: [toolkitSlug],
    important: false,
    limit: 500,
  });
  const recommendedTools = new Set(getRecommendedChatToolsForToolkit(toolkitSlug));

  return Array.from(
    new Map(
      (tools as unknown[])
        .map((tool) => {
          const name = extractToolDefinitionName(tool);

          if (!name || !isToolNameForToolkit(name, toolkitSlug)) {
            return null;
          }

          return [
            name,
            {
              name,
              description: extractToolDefinitionDescription(tool),
              recommended: recommendedTools.has(name),
            } satisfies ToolkitActionOption,
          ] as const;
        })
        .filter(Boolean) as Array<readonly [string, ToolkitActionOption]>,
    ).values(),
  ).sort((left, right) => {
    if (left.recommended !== right.recommended) {
      return left.recommended ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export async function getWrappedTools(
  userId: string,
  toolkitSlugs: string[],
  enabledToolsByToolkit?: EnabledToolSelection | null,
) {
  const composio = createComposioClient();

  if (!composio) {
    console.error("[Composio] No composio client available in getWrappedTools");
    return [];
  }

  const selectedTools = getSelectedChatToolsForToolkits(
    toolkitSlugs,
    enabledToolsByToolkit,
  );
  const builtInToolkits = toolkitSlugs.filter(isInternalAssistantToolkitSlug);

  if (selectedTools.length === 0 && builtInToolkits.length === 0) {
    return [];
  }

  try {
    const toolCollections = await Promise.all([
      selectedTools.length > 0
        ? composio.tools.get(userId, {
            tools: selectedTools,
          })
        : Promise.resolve([]),
      builtInToolkits.length > 0
        ? composio.tools.get(userId, {
            toolkits: builtInToolkits,
          })
        : Promise.resolve([]),
    ]);

    return toolCollections.flat();
  } catch (error) {
    console.error("[Composio] Failed to get tools:", error);
    return [];
  }
}

export async function handleChatToolCalls(
  userId: string,
  chatCompletion: OpenAI.Chat.ChatCompletion,
  options?: {
    gmailRecipientPolicy?: GmailRecipientPolicy | null;
    googleCalendarSelection?: GoogleCalendarSelection | null;
    calSelection?: CalSelection | null;
  },
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

    const patchedCompletion = applyEmailRecipientPolicyToCompletion(
      applyCalSelectionToCompletion(
        applyGoogleCalendarSelectionToCompletion(
          chatCompletion,
          options?.googleCalendarSelection ?? null,
        ),
        options?.calSelection ?? null,
      ),
      options?.gmailRecipientPolicy ?? null,
    );
    let sessionWasRecreated = false;

    // Retry once if we get a serverless cache miss error from Composio.
    try {
      const results = await composio.provider.handleToolCalls(userId, patchedCompletion);

      return {
        results: sanitizeEmailToolMessages(results, options?.gmailRecipientPolicy ?? null),
        sessionWasRecreated,
      };
    } catch (error) {
      if (error && typeof error === "object" && "message" in error) {
        // Look for typical missing session / unauthorized errors from Composio
        const msg = String(error.message).toLowerCase();
        if (msg.includes("session") || msg.includes("unauthorized") || msg.includes("not found")) {
          console.warn("[Composio] Session appears missing or expired, attempting recreation...", userId);
          const newSession = await composio.create(userId, {
            toolkits: COMPOSIO_SESSION_TOOLKITS,
          });
          
          if (newSession) {
            composioSessionCache.set(userId, newSession);
            sessionWasRecreated = true;

            // Retry handling tool calls with the new session
            const retryResults = await composio.provider.handleToolCalls(userId, patchedCompletion);
            return {
              results: sanitizeEmailToolMessages(
                retryResults,
                options?.gmailRecipientPolicy ?? null,
              ),
              sessionWasRecreated,
            };
          }
        }
      }
      
      // If we made it here, it's either an unrecognized error or recreation failed.
      console.error("[Composio] Failed to handle tool calls:", error);
      throw error;
    }
}

function applyGoogleCalendarSelectionToCompletion(
  chatCompletion: OpenAI.Chat.ChatCompletion,
  googleCalendarSelection: GoogleCalendarSelection | null,
) {
  const selectedCalendarId = googleCalendarSelection?.calendarId ?? "primary";
  const selectedCalendarTimezone = pickString(googleCalendarSelection?.timezone);

  if (!googleCalendarSelection) {
    return chatCompletion;
  }

  const message = chatCompletion.choices[0]?.message;
  if (!message || !Array.isArray(message.tool_calls)) {
    return chatCompletion;
  }

  const includePrimaryCalendar =
    googleCalendarSelection.includePrimaryCalendar &&
    Boolean(googleCalendarSelection.calendarId) &&
    selectedCalendarId !== "primary";
  const availabilityItems = includePrimaryCalendar
    ? [selectedCalendarId, "primary"]
    : [selectedCalendarId];

  function getLocalParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    const parts = formatter.formatToParts(date);
    const map = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;

    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  }

  function getOffsetMinutes(date: Date, timeZone: string) {
    const parts = getLocalParts(date, timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    return Math.round((localAsUtc - date.getTime()) / 60000);
  }

  function formatOffset(offsetMinutes: number) {
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
    const minutes = String(absoluteMinutes % 60).padStart(2, "0");
    return `${sign}${hours}:${minutes}`;
  }

  function hasExplicitOffset(value: string) {
    return /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  }

  function localDateTimeToOffsetIso(value: string, timeZone: string) {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (!match) {
      return value;
    }

    const [, year, month, day, hour, minute, second = "00"] = match;
    const targetAsUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );

    let candidate = new Date(targetAsUtc);

    for (let iteration = 0; iteration < 2; iteration += 1) {
      const parts = getLocalParts(candidate, timeZone);
      const candidateAsUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
      const diffMs = targetAsUtc - candidateAsUtc;

      if (diffMs === 0) {
        break;
      }

      candidate = new Date(candidate.getTime() + diffMs);
    }

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${formatOffset(
      getOffsetMinutes(candidate, timeZone),
    )}`;
  }

  function withCalendarTimezone(arguments_: Record<string, unknown>) {
    if (!selectedCalendarTimezone) {
      return arguments_;
    }

    const nextArguments = { ...arguments_ };

    if (
      typeof nextArguments.start_datetime === "string" &&
      !hasExplicitOffset(nextArguments.start_datetime)
    ) {
      nextArguments.start_datetime = localDateTimeToOffsetIso(
        nextArguments.start_datetime,
        selectedCalendarTimezone,
      );
    }

    if (
      typeof nextArguments.end_datetime === "string" &&
      !hasExplicitOffset(nextArguments.end_datetime)
    ) {
      nextArguments.end_datetime = localDateTimeToOffsetIso(
        nextArguments.end_datetime,
        selectedCalendarTimezone,
      );
    }

    if (
      typeof nextArguments.time_min === "string" &&
      !hasExplicitOffset(nextArguments.time_min)
    ) {
      nextArguments.time_min = localDateTimeToOffsetIso(
        nextArguments.time_min,
        selectedCalendarTimezone,
      );
    }

    if (
      typeof nextArguments.time_max === "string" &&
      !hasExplicitOffset(nextArguments.time_max)
    ) {
      nextArguments.time_max = localDateTimeToOffsetIso(
        nextArguments.time_max,
        selectedCalendarTimezone,
      );
    }

    nextArguments.timezone = selectedCalendarTimezone;
    return nextArguments;
  }

  const patchedToolCalls = message.tool_calls.flatMap((toolCall) => {
    if (toolCall.type !== "function") {
      return [toolCall];
    }

    const rawArguments = toolCall.function.arguments ?? "";
    if (!rawArguments.trim()) {
      return [toolCall];
    }

    try {
      const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
      let nextToolCalls: typeof message.tool_calls | null = null;

      if (toolCall.function.name === GOOGLE_CALENDAR_CREATE_EVENT_TOOL) {
        const selectedCalendarArguments = withCalendarTimezone({
          ...parsed,
          calendar_id: selectedCalendarId,
        });
        const selectedCalendarCall = {
          ...toolCall,
          function: {
            ...toolCall.function,
            arguments: JSON.stringify(selectedCalendarArguments),
          },
        };

        nextToolCalls = includePrimaryCalendar
          ? [
              selectedCalendarCall,
              {
                ...toolCall,
                id: `${toolCall.id}_primary`,
                function: {
                  ...toolCall.function,
                  arguments: JSON.stringify(
                    withCalendarTimezone({
                      ...parsed,
                      calendar_id: "primary",
                    }),
                  ),
                },
              },
            ]
          : [selectedCalendarCall];
      }

      if (toolCall.function.name === GOOGLE_CALENDAR_QUICK_ADD_TOOL) {
        const selectedCalendarCall = {
          ...toolCall,
          function: {
            ...toolCall.function,
            arguments: JSON.stringify(
              withCalendarTimezone({
                ...parsed,
                calendar_id: selectedCalendarId,
              }),
            ),
          },
        };

        nextToolCalls = includePrimaryCalendar
          ? [
              selectedCalendarCall,
              {
                ...toolCall,
                id: `${toolCall.id}_primary`,
                function: {
                  ...toolCall.function,
                  arguments: JSON.stringify(
                    withCalendarTimezone({
                      ...parsed,
                      calendar_id: "primary",
                    }),
                  ),
                },
              },
            ]
          : [selectedCalendarCall];
      }

      if (toolCall.function.name === GOOGLE_CALENDAR_FIND_FREE_SLOTS_TOOL) {
        nextToolCalls = [
          {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: JSON.stringify(
                withCalendarTimezone({
                  ...parsed,
                  items: availabilityItems,
                }),
              ),
            },
          },
        ];
      }

      if (toolCall.function.name === GOOGLE_CALENDAR_FREE_BUSY_QUERY_TOOL) {
        nextToolCalls = [
          {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: JSON.stringify(
                withCalendarTimezone({
                  ...parsed,
                  items: availabilityItems,
                }),
              ),
            },
          },
        ];
      }

      if (!nextToolCalls) {
        return [toolCall];
      }

      return nextToolCalls;
    } catch {
      return [toolCall];
    }
  });

  return {
    ...chatCompletion,
    choices: chatCompletion.choices.map((choice, index) =>
      index === 0
        ? {
            ...choice,
            message: {
              ...message,
              tool_calls: patchedToolCalls,
            },
          }
        : choice,
    ),
  };
}

function applyEmailRecipientPolicyToCompletion(
  chatCompletion: OpenAI.Chat.ChatCompletion,
  emailRecipientPolicy: GmailRecipientPolicy | null,
) {
  if (
    emailRecipientPolicy?.mode !== "specific_email" ||
    !normalizeGmailRecipientEmail(emailRecipientPolicy.specificEmail)
  ) {
    return chatCompletion;
  }

  const message = chatCompletion.choices[0]?.message;
  if (!message || !Array.isArray(message.tool_calls)) {
    return chatCompletion;
  }

  const specificEmail = normalizeGmailRecipientEmail(emailRecipientPolicy.specificEmail);
  if (!specificEmail) {
    return chatCompletion;
  }

  const patchedToolCalls = message.tool_calls.map((toolCall) => {
    if (
      toolCall.type !== "function" ||
      (toolCall.function.name !== GMAIL_SEND_EMAIL_TOOL &&
        toolCall.function.name !== OUTLOOK_SEND_EMAIL_TOOL)
    ) {
      return toolCall;
    }

    const rawArguments = toolCall.function.arguments ?? "";
    if (!rawArguments.trim()) {
      return toolCall;
    }

    try {
      const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
      const nextArguments: Record<string, unknown> = {
        ...parsed,
        recipient_email: specificEmail,
      };

      delete nextArguments.cc;
      delete nextArguments.bcc;
      delete nextArguments.extra_recipients;

      return {
        ...toolCall,
        function: {
          ...toolCall.function,
          arguments: JSON.stringify(nextArguments),
        },
      };
    } catch {
      return toolCall;
    }
  });

  return {
    ...chatCompletion,
    choices: chatCompletion.choices.map((choice, index) =>
      index === 0
        ? {
            ...choice,
            message: {
              ...message,
              tool_calls: patchedToolCalls,
            },
          }
        : choice,
    ),
  };
}

function sanitizeEmailToolMessages(
  messages: OpenAI.Chat.ChatCompletionToolMessageParam[] | Array<Record<string, unknown>>,
  emailRecipientPolicy: GmailRecipientPolicy | null,
) {
  if (
    emailRecipientPolicy?.mode !== "specific_email" ||
    !normalizeGmailRecipientEmail(emailRecipientPolicy.specificEmail)
  ) {
    return messages;
  }

  return messages.map((message) =>
    ("name" in message &&
      (message.name === GMAIL_SEND_EMAIL_TOOL ||
        message.name === OUTLOOK_SEND_EMAIL_TOOL))
      ? {
          ...message,
          content: "Internal notification email sent successfully.",
        }
      : message,
  );
}

export async function executeToolCall(
  userId: string,
  toolName: string,
  arguments_: Record<string, unknown>,
  options?: { connectedAccountId?: string | null },
) {
  const composio = createComposioClient();

  if (!composio) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  const result = await composio.tools.execute(toolName, {
    userId,
    arguments: arguments_,
    ...(options?.connectedAccountId
      ? { connectedAccountId: options.connectedAccountId }
      : {}),
  } as Record<string, unknown>);

  if (!result.successful) {
    throw new Error(result.error ?? `Failed to execute tool: ${toolName}`);
  }

  return result.data;
}

export async function listGoogleCalendars(
  composioUserId: string,
  connectedAccountId?: string | null,
) {
  const result = await executeToolCall(
    composioUserId,
    "GOOGLECALENDAR_LIST_CALENDARS",
    {},
    {
      connectedAccountId,
    },
  );

  return extractGoogleCalendarListItems(result);
}

export async function listDriveImportFiles(
  composioUserId: string,
  search = "",
  pageToken?: string,
  connectedAccountId?: string | null,
) {
  const result = await executeToolCall(
    composioUserId,
    "GOOGLEDRIVE_FIND_FILE",
    {
      q: buildDriveSearchQuery(search),
      corpora: "user",
      pageSize: 20,
      pageToken,
    },
    {
      connectedAccountId,
    },
  );

  const files = extractDriveFileArray(result);
  const nextPageToken = pickString(result.nextPageToken) ?? pickString(result.pageToken);

  return {
    files,
    nextPageToken,
    raw: result,
  };
}

export async function getDriveFileMetadata(
  composioUserId: string,
  fileId: string,
  connectedAccountId?: string | null,
) {
  const result = await executeToolCall(
    composioUserId,
    "GOOGLEDRIVE_GET_FILE_METADATA",
    {
      fileId,
    },
    {
      connectedAccountId,
    },
  );

  const record =
    createDriveFileRecord(result) ??
    createDriveFileRecord(
      (typeof result.file === "object" && result.file !== null
        ? result.file
        : {}) as Record<string, unknown>,
    );

  if (!record) {
    throw new Error("Google Drive metadata response was incomplete.");
  }

  return {
    ...record,
    webViewLink: record.webViewLink ?? pickString(result.webViewLink),
    raw: result,
  };
}

export async function downloadDriveFile(
  composioUserId: string,
  fileId: string,
  connectedAccountId?: string | null,
) {
  return executeToolCall(
    composioUserId,
    "GOOGLEDRIVE_DOWNLOAD_FILE",
    {
      file_id: fileId,
    },
    {
      connectedAccountId,
    },
  );
}

function applyCalSelectionToCompletion(
  chatCompletion: OpenAI.Chat.ChatCompletion,
  calSelection: CalSelection | null,
) {
  if (!calSelection) {
    return chatCompletion;
  }

  const message = chatCompletion.choices[0]?.message;
  if (!message || !Array.isArray(message.tool_calls)) {
    return chatCompletion;
  }

  const selectedEventTypeId = calSelection.eventTypeMode === "specific_event_type" 
    ? calSelection.eventTypeId 
    : null;
  const selectedTimezone = pickString(calSelection.timezone);

  const patchedToolCalls = message.tool_calls.flatMap((toolCall) => {
    if (toolCall.type !== "function") {
      return [toolCall];
    }

    const rawArguments = toolCall.function.arguments ?? "";
    if (!rawArguments.trim()) {
      return [toolCall];
    }

    try {
      const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
      let nextToolCalls: typeof message.tool_calls | null = null;

      if (
        toolCall.function.name === CAL_GET_AVAILABLE_SLOTS_INFO_TOOL ||
        toolCall.function.name === CAL_CREATE_BOOKING_VERSION_2_TOOL
      ) {
        const nextArguments: Record<string, unknown> = {
          ...parsed,
        };

        if (selectedEventTypeId) {
          nextArguments.event_type_id = selectedEventTypeId;
        }

        if (selectedTimezone) {
          nextArguments.timezone = selectedTimezone;
        }

        nextToolCalls = [
          {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: JSON.stringify(nextArguments),
            },
          },
        ];
      }

      if (!nextToolCalls) {
        return [toolCall];
      }

      return nextToolCalls;
    } catch {
      return [toolCall];
    }
  });

  return {
    ...chatCompletion,
    choices: chatCompletion.choices.map((choice, index) =>
      index === 0
        ? {
            ...choice,
            message: {
              ...message,
              tool_calls: patchedToolCalls,
            },
          }
        : choice,
    ),
  };
}

export interface CalEventType {
  id: string;
  title: string;
  slug: string;
}

// Maps a raw array of Cal.com event type objects to CalEventType[], handling both
// string and integer id fields (the API returns integers).
function flattenEventTypeItems(items: unknown[]): CalEventType[] {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const rawId = record.id ?? record.eventTypeId;
      const id =
        typeof rawId === "number" && rawId > 0
          ? String(rawId)
          : pickString(rawId);
      const title = pickString(record.title) ?? pickString(record.name);
      const slug = pickString(record.slug);
      if (!id || !title) return null;
      return { id, title, slug: slug ?? "" } satisfies CalEventType;
    })
    .filter(Boolean) as CalEventType[];
}

function extractCalEventTypes(payload: unknown): CalEventType[] {
  // Composio sometimes returns data as a JSON-encoded string — parse it first.
  let root = payload;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }

  const candidate =
    typeof root === "object" && root !== null
      ? (root as Record<string, unknown>)
      : null;

  // Parse candidate.data if it's also a JSON string
  let parsedData: Record<string, unknown> | null = null;
  if (candidate?.data && typeof candidate.data === "string") {
    try {
      const d = JSON.parse(candidate.data as string);
      parsedData = typeof d === "object" && d !== null ? (d as Record<string, unknown>) : null;
    } catch {
      // ignored
    }
  } else if (candidate?.data && typeof candidate.data === "object") {
    parsedData = candidate.data as Record<string, unknown>;
  }

  // ─── PRIMARY: CAL API v2 shape ─────────────────────────────────────────────
  // CAL_LIST_EVENT_TYPES returns: { data: { eventTypeGroups: [{ eventTypes: [...] }] } }
  // Flatten all groups into a single array.
  const groups = parsedData?.eventTypeGroups;
  if (Array.isArray(groups) && groups.length > 0) {
    const flattened = groups.flatMap((group) => {
      const g = group as Record<string, unknown>;
      return Array.isArray(g.eventTypes) ? (g.eventTypes as unknown[]) : [];
    });
    if (flattened.length > 0) {
      return flattenEventTypeItems(flattened);
    }
  }

  // ─── FALLBACKS: other possible shapes ──────────────────────────────────────
  const buckets = [
    candidate?.event_types,
    candidate?.eventTypes,
    candidate?.result,
    Array.isArray(root) ? root : null,
    parsedData?.event_types,
    parsedData?.eventTypes,
    parsedData?.result,
    parsedData?.data,
    candidate?.data,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    const eventTypes = flattenEventTypeItems(bucket);

    if (eventTypes.length > 0) {
      return eventTypes;
    }
  }

  return [];
}

export async function listCalEventTypes(
  composioUserId: string,
  connectedAccountId?: string | null,
): Promise<CalEventType[]> {
  try {
    const result = await executeToolCall(
      composioUserId,
      "CAL_LIST_EVENT_TYPES",
      {},
      { connectedAccountId },
    );
    return extractCalEventTypes(result);
  } catch (error) {
    console.warn(
      `[Cal.com] CAL_LIST_EVENT_TYPES failed for compUserId: ${composioUserId}, connectionId: ${connectedAccountId ?? "none"}. Falling back to manual input.`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
