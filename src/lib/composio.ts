import { Composio } from "@composio/core";
import type OpenAI from "openai";
import { hasComposioEnv } from "@/lib/env";
import { normalizeGmailRecipientEmail } from "@/lib/gmail";
import { extractGoogleCalendarListItems } from "@/lib/google-calendar";
import type {
  DriveImportFileRecord,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
} from "@/lib/types";
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

const GMAIL_SEND_EMAIL_TOOL = "GMAIL_SEND_EMAIL";
const GOOGLE_CALENDAR_CREATE_EVENT_TOOL = "GOOGLECALENDAR_CREATE_EVENT";
const GOOGLE_CALENDAR_QUICK_ADD_TOOL = "GOOGLECALENDAR_QUICK_ADD";
const GOOGLE_CALENDAR_FIND_FREE_SLOTS_TOOL = "GOOGLECALENDAR_FIND_FREE_SLOTS";
const GOOGLE_CALENDAR_FREE_BUSY_QUERY_TOOL = "GOOGLECALENDAR_FREE_BUSY_QUERY";

const DEFAULT_COMPOSIO_TOOLKIT_VERSIONS = {
  gmail: process.env.COMPOSIO_TOOLKIT_VERSION_GMAIL ?? "20260307_00",
  googlecalendar: process.env.COMPOSIO_TOOLKIT_VERSION_GOOGLECALENDAR ?? "20260309_00",
  googledrive: process.env.COMPOSIO_TOOLKIT_VERSION_GOOGLEDRIVE ?? "20260309_00",
} as const;

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

  await getComposioSession(userId);
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

  const request = await composio.connectedAccounts.link(userId, authConfigId);

  return {
    id: request.id,
    authConfigId,
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
  options?: {
    gmailRecipientPolicy?: GmailRecipientPolicy | null;
    googleCalendarSelection?: GoogleCalendarSelection | null;
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

    const patchedCompletion = applyGmailRecipientPolicyToCompletion(
      applyGoogleCalendarSelectionToCompletion(
        chatCompletion,
        options?.googleCalendarSelection ?? null,
      ),
      options?.gmailRecipientPolicy ?? null,
    );
    let sessionToUse = session;
    let sessionWasRecreated = false;

    // Retry once if we get a serverless cache miss error from Composio.
    try {
      const results = await composio.provider.handleToolCalls(userId, patchedCompletion);
      
      if (results && results.length > 0) {
        console.log("[Composio] Tool call results:", results.length);
      }
      
      return {
        results: sanitizeGmailToolMessages(results, options?.gmailRecipientPolicy ?? null),
        sessionWasRecreated,
      };
    } catch (error) {
      if (error && typeof error === "object" && "message" in error) {
        // Look for typical missing session / unauthorized errors from Composio
        const msg = String(error.message).toLowerCase();
        if (msg.includes("session") || msg.includes("unauthorized") || msg.includes("not found")) {
          console.warn("[Composio] Session appears missing or expired, attempting recreation...", userId);
          const newSession = await composio.create(userId, {
            toolkits: SUPPORTED_INTEGRATIONS.map((integration) => integration.slug),
          });
          
          if (newSession) {
            composioSessionCache.set(userId, newSession);
            sessionWasRecreated = true;
            console.log("[Composio] Session recreated successfully.");
            
            // Retry handling tool calls with the new session
            const retryResults = await composio.provider.handleToolCalls(userId, patchedCompletion);
            return {
              results: sanitizeGmailToolMessages(
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

function applyGmailRecipientPolicyToCompletion(
  chatCompletion: OpenAI.Chat.ChatCompletion,
  gmailRecipientPolicy: GmailRecipientPolicy | null,
) {
  if (
    gmailRecipientPolicy?.mode !== "specific_email" ||
    !normalizeGmailRecipientEmail(gmailRecipientPolicy.specificEmail)
  ) {
    return chatCompletion;
  }

  const message = chatCompletion.choices[0]?.message;
  if (!message || !Array.isArray(message.tool_calls)) {
    return chatCompletion;
  }

  const specificEmail = normalizeGmailRecipientEmail(gmailRecipientPolicy.specificEmail);
  if (!specificEmail) {
    return chatCompletion;
  }

  const patchedToolCalls = message.tool_calls.map((toolCall) => {
    if (
      toolCall.type !== "function" ||
      toolCall.function.name !== GMAIL_SEND_EMAIL_TOOL
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

function sanitizeGmailToolMessages(
  messages: OpenAI.Chat.ChatCompletionToolMessageParam[] | Array<Record<string, unknown>>,
  gmailRecipientPolicy: GmailRecipientPolicy | null,
) {
  if (
    gmailRecipientPolicy?.mode !== "specific_email" ||
    !normalizeGmailRecipientEmail(gmailRecipientPolicy.specificEmail)
  ) {
    return messages;
  }

  return messages.map((message) =>
    ("name" in message && message.name === GMAIL_SEND_EMAIL_TOOL)
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
  userId: string,
  connectedAccountId?: string | null,
) {
  const result = await executeToolCall(
    userId,
    "GOOGLECALENDAR_LIST_CALENDARS",
    {},
    {
      connectedAccountId,
    },
  );

  return extractGoogleCalendarListItems(result);
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
