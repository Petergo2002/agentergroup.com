import type { NextRequest } from "next/server";
import { getAppUrl, getWidgetAppUrl } from "@/lib/env";
import type {
  AgentRecord,
  AgentVersionRecord,
  WidgetDraftPreviewInput,
  WidgetAgentRecord,
  WidgetLeadRecord,
  WidgetPreviewDraftRecord,
  WidgetRecord,
  WidgetSessionMessageRecord,
  WidgetSessionRecord,
} from "@/lib/types";
import {
  buildDraftPreviewWidgetAgentId,
  buildHostedWidgetUrl,
  buildWidgetEmbedSnippet,
  buildWidgetRuntimeConfig,
  buildWidgetRuntimeConfigFromDraft,
  normalizeAllowedOrigin,
  normalizeAllowedOrigins,
  type WidgetAgentWithAgent,
} from "@/lib/widgets";

interface WidgetQueryResult<TData> {
  data?: TData | null;
  error?: { message: string } | null;
}

interface WidgetSelectBuilder<TData> {
  eq: (column: string, value: string) => WidgetSelectBuilder<TData>;
  maybeSingle: () => Promise<WidgetQueryResult<TData>>;
}

// Represents a builder that has been ordered and supports .limit() to fetch rows.
interface WidgetLimitSelectBuilder<TData> {
  limit: (count: number) => Promise<WidgetQueryResult<TData>>;
}

interface WidgetOrderedSelectBuilder<TData> extends WidgetSelectBuilder<TData> {
  eq: (column: string, value: string) => WidgetOrderedSelectBuilder<TData>;
  // order() returns a limit builder; TData[] means the result data is an array of TData.
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => WidgetLimitSelectBuilder<TData[]>;
}

interface WidgetInSelectBuilder<TData> {
  in: (column: string, values: string[]) => Promise<WidgetQueryResult<TData[]>>;
}

interface WidgetOrderedInSelectBuilder<TData> extends WidgetOrderedSelectBuilder<TData> {
  in: (column: string, values: string[]) => Promise<WidgetQueryResult<TData[]>>;
}

interface WidgetMutationBuilder<TData> extends PromiseLike<WidgetQueryResult<TData>> {
  select: (columns?: string) => {
    single: () => Promise<WidgetQueryResult<TData>>;
  };
}

interface WidgetTableQuery {
  select: <TData = unknown>(columns?: string) => WidgetOrderedInSelectBuilder<TData>;
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => WidgetMutationBuilder<unknown>;
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[],
  ) => WidgetMutationBuilder<unknown>;
}

export interface WidgetAdminSupabase {
  from: (table: string) => WidgetTableQuery;
}

interface WidgetPreviewDraftRow extends WidgetPreviewDraftRecord {
  payload: WidgetDraftPreviewInput;
}

export interface WidgetPreviewTokenPayload {
  widgetPublicKey: string;
  widgetId: string;
  workspaceId: string;
  userId: string;
  revision?: string;
  expiresAt: number;
  issuedAt: number;
}

export interface RuntimeWidgetAgentSelection {
  widgetAgentId: string;
  persistedWidgetAgentId: string | null;
  publishedVersionId: string | null;
  agent: AgentRecord;
}

const WIDGET_PREVIEW_TTL_MS = 15 * 60 * 1000;
const DEPLOY_TIMESTAMP_SKEW_MS = 2000;

async function loadWidgetAgentsWithAgents(
  supabase: WidgetAdminSupabase,
  widgetId: string,
) {
  const widgetAgentsQuery = supabase
    .from("widget_agents")
    .select<WidgetAgentRecord>("*") as unknown as WidgetOrderedSelectBuilder<WidgetAgentRecord>;

  // .order() returns WidgetLimitSelectBuilder, so we must call .limit() to get the Promise.
  const { data: widgetAgentRows, error: widgetAgentsError } = await widgetAgentsQuery
    .eq("widget_id", widgetId)
    .order("sort_order", { ascending: true })
    .limit(1000);

  if (widgetAgentsError) {
    throw new Error(widgetAgentsError.message);
  }

  const typedWidgetAgents = (widgetAgentRows ?? []) as WidgetAgentRecord[];

  if (typedWidgetAgents.length === 0) {
    return [] as WidgetAgentWithAgent[];
  }

  const agentIds = Array.from(
    new Set(typedWidgetAgents.map((widgetAgent) => widgetAgent.agent_id).filter(Boolean)),
  );

  const agentsQuery = supabase
    .from("agents")
    .select<AgentRecord>("*") as unknown as WidgetInSelectBuilder<AgentRecord>;

  const { data: agentRows, error: agentsError } = await agentsQuery
    .in("id", agentIds);

  if (agentsError) {
    throw new Error(agentsError.message);
  }

  const agentById = new Map(
    ((agentRows ?? []) as AgentRecord[]).map((agent) => [agent.id, agent]),
  );

  return typedWidgetAgents
    .map((widgetAgent) => {
      const agent = agentById.get(widgetAgent.agent_id);
      if (!agent) {
        return null;
      }

      return {
        widgetAgent,
        agent,
      };
    })
    .filter(Boolean) as WidgetAgentWithAgent[];
}

export function getRequestOrigin(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const referrerHeader = request.headers.get("referer");
  return (
    normalizeAllowedOrigin(originHeader) ??
    normalizeAllowedOrigin(referrerHeader) ??
    null
  );
}

export function getWidgetRequestSource(request: NextRequest) {
  if (request.headers.get("x-ag-preview-token")) {
    return "preview" as const;
  }

  const contextHeader = request.headers.get("x-ag-widget-context");

  if (contextHeader === "embedded") {
    return "embedded" as const;
  }

  return "hosted" as const;
}

export function getRequestedParentOrigin(request: NextRequest) {
  const headerValue = request.headers.get("x-ag-parent-origin");
  return normalizeAllowedOrigin(headerValue) ?? getRequestOrigin(request);
}

export function buildWidgetCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");

  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,x-ag-widget-context,x-ag-parent-origin,x-ag-preview-token,x-ag-preview-source,x-ag-preview-revision",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function isAllowedWidgetOrigin(
  widget: WidgetRecord,
  request: NextRequest,
) {
  const source = getWidgetRequestSource(request);

  if (source !== "embedded") {
    return true;
  }

  const requestedOrigin = getRequestedParentOrigin(request);

  if (!requestedOrigin) {
    return false;
  }

  return normalizeAllowedOrigins(widget.allowed_origins).includes(requestedOrigin);
}

export async function loadWidgetById(
  supabase: WidgetAdminSupabase,
  widgetId: string,
) {
  const { data, error } = await supabase
    .from("widgets")
    .select("*")
    .eq("id", widgetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as WidgetRecord;
  return {
    widget: row,
    widgetAgents: await loadWidgetAgentsWithAgents(supabase, row.id),
  };
}

export async function loadWidgetByPublicKey(
  supabase: WidgetAdminSupabase,
  widgetPublicKey: string,
) {
  const { data, error } = await supabase
    .from("widgets")
    .select("*")
    .eq("widget_public_key", widgetPublicKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as WidgetRecord;
  return {
    widget: row,
    widgetAgents: await loadWidgetAgentsWithAgents(supabase, row.id),
  };
}

export async function loadAllWidgetsWithAgents(
  supabase: WidgetAdminSupabase,
  workspaceId: string,
) {
  const { data: widgetsData, error: widgetsError } = await (supabase
    .from("widgets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false }) as unknown as Promise<{ data: WidgetRecord[] | null; error: { message: string } | null }>);

  if (widgetsError) {
    throw new Error(widgetsError.message);
  }

  if (!widgetsData || widgetsData.length === 0) {
    return [];
  }

  const widgets = widgetsData;
  const widgetIds = widgets.map((w) => w.id);

  const { data: widgetAgentsData, error: widgetAgentsError } = await (supabase
    .from("widget_agents")
    .select("*")
    .in("widget_id", widgetIds) as unknown as Promise<{ data: WidgetAgentRecord[] | null; error: { message: string } | null }>);

  if (widgetAgentsError) {
    throw new Error(widgetAgentsError.message);
  }

  const widgetAgentsByWidgetId = new Map<string, WidgetAgentRecord[]>();
  for (const wa of widgetAgentsData ?? []) {
    const existing = widgetAgentsByWidgetId.get(wa.widget_id) ?? [];
    existing.push(wa);
    widgetAgentsByWidgetId.set(wa.widget_id, existing);
  }

  const agentIds = Array.from(
    new Set(
      (widgetAgentsData ?? [])
        .map((wa) => wa.agent_id)
        .filter(Boolean) as string[],
    ),
  );

  let agents: AgentRecord[] = [];
  if (agentIds.length > 0) {
    const { data: agentsData, error: agentsError } = await (supabase
      .from("agents")
      .select("*")
      .in("id", agentIds) as unknown as Promise<{ data: AgentRecord[] | null; error: { message: string } | null }>);

    if (agentsError) {
      throw new Error(agentsError.message);
    }

    agents = agentsData ?? [];
  }

  const agentById = new Map(agents.map((a) => [a.id, a]));

  return widgets.map((widget) => {
    const widgetAgents = (widgetAgentsByWidgetId.get(widget.id) ?? [])
      .map((wa) => {
        const agent = agentById.get(wa.agent_id);
        if (!agent) return null;
        return { widgetAgent: wa, agent };
      })
      .filter(Boolean) as WidgetAgentWithAgent[];

    return {
      widget,
      widgetAgents,
    };
  });
}

export async function getPublishedAgentVersion(
  supabase: WidgetAdminSupabase,
  publishedVersionId: string | null,
) {
  if (!publishedVersionId) {
    return null;
  }

  const { data, error } = await supabase
    .from("agent_versions")
    .select("*")
    .eq("id", publishedVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AgentVersionRecord | null;
}

export function getWidgetRuntimeAgent(
  agent: AgentRecord,
  version: AgentVersionRecord | null,
) {
  const config = version?.definition?.config;

  return {
    ...agent,
    model: config?.model ?? agent.model,
    instructions: config?.instructions ?? agent.instructions,
  };
}

export function getWidgetNeedsRedeploy(
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
) {
  if (widget.status !== "deployed") {
    return false;
  }

  if (!widget.deployed_at || widgetAgents.length === 0) {
    return true;
  }

  const deployedAt = new Date(widget.deployed_at).getTime();
  const widgetUpdatedAt = new Date(widget.updated_at).getTime();

  // Deploy actions update the widget row and attached widget agent rows, and the
  // DB trigger can stamp updated_at slightly after the app-provided deployed_at.
  // Treat small deltas as the same deploy event rather than a real stale state.
  if (widgetUpdatedAt - deployedAt > DEPLOY_TIMESTAMP_SKEW_MS) {
    return true;
  }

  return widgetAgents.some(({ widgetAgent, agent }) => {
    const widgetAgentUpdatedAt = new Date(widgetAgent.updated_at).getTime();
    return (
      widgetAgentUpdatedAt - deployedAt > DEPLOY_TIMESTAMP_SKEW_MS ||
      widgetAgent.published_version_id !== agent.published_version_id
    );
  });
}

export function buildWidgetSummary(
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
  options?: { preview?: boolean },
) {
  return {
    widget,
    attachedAgents: widgetAgents,
    runtimeConfig: buildWidgetRuntimeConfig(widget, widgetAgents, options),
    hostedUrl: buildHostedWidgetUrl(widget.widget_public_key),
    embedSnippet: buildWidgetEmbedSnippet(widget.widget_public_key),
    needsRedeploy: getWidgetNeedsRedeploy(widget, widgetAgents),
  };
}

export async function createWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    workspaceId: string;
    createdBy: string;
    revision: string;
    payload: WidgetDraftPreviewInput;
    expiresAt: string;
  },
) {
  const { data, error } = await supabase
    .from("widget_preview_drafts")
    .insert({
      widget_id: input.widgetId,
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      revision: input.revision,
      payload: input.payload,
      expires_at: input.expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create widget preview draft.");
  }

  return data as WidgetPreviewDraftRecord;
}

export async function loadWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  widgetId: string,
  revision: string,
) {
  const { data, error } = await supabase
    .from("widget_preview_drafts")
    .select("*")
    .eq("widget_id", widgetId)
    .eq("revision", revision)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const draft = data as WidgetPreviewDraftRow;
  if (new Date(draft.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return draft;
}

export async function loadWidgetAgentsByIds(
  supabase: WidgetAdminSupabase,
  workspaceId: string,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return [] as AgentRecord[];
  }

  const table = supabase.from("agents");
  const selectBuilder = table.select("*").eq("workspace_id", workspaceId);

  const result = "in" in selectBuilder
    ? await (
        selectBuilder as WidgetSelectBuilder<unknown[]> & {
          in: (column: string, values: string[]) => Promise<WidgetQueryResult<unknown[]>>;
        }
      ).in("id", agentIds)
    : await selectBuilder.maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = Array.isArray(result.data)
    ? result.data
    : result.data
      ? [result.data]
      : [];

  return (rows as AgentRecord[]).filter((agent) => !agent.archived_at);
}

export async function resolveWidgetPreviewContext(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  request: NextRequest,
) {
  const previewToken = request.headers.get("x-ag-preview-token");
  const previewPayload = await verifyWidgetPreviewToken(previewToken, widget.widget_public_key);

  if (!previewPayload) {
    return {
      isPreview: false,
      previewPayload: null,
      previewDraft: null,
      runtimeConfig: null,
    };
  }

  const requestedRevision =
    request.headers.get("x-ag-preview-revision")?.trim() ||
    previewPayload.revision ||
    null;

  if (!requestedRevision) {
    return {
      isPreview: true,
      previewPayload,
      previewDraft: null,
      runtimeConfig: null,
    };
  }

  const previewDraft = await loadWidgetPreviewDraft(
    supabase,
    widget.id,
    requestedRevision,
  );

  return {
    isPreview: true,
    previewPayload,
    previewDraft,
    runtimeConfig: previewDraft
      ? buildWidgetRuntimeConfigFromDraft(widget, previewDraft.payload, {
          preview: true,
        })
      : null,
  };
}

export function buildStoredWidgetRuntimeAgents(
  widgetAgents: WidgetAgentWithAgent[],
): RuntimeWidgetAgentSelection[] {
  return widgetAgents.map(({ widgetAgent, agent }) => ({
    widgetAgentId: widgetAgent.id,
    persistedWidgetAgentId: widgetAgent.id,
    publishedVersionId: widgetAgent.published_version_id,
    agent,
  }));
}

export async function buildDraftWidgetRuntimeAgents(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  draft: WidgetDraftPreviewInput,
) {
  const orderedDraftAgents = [...draft.agents].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const referencedAgents = await loadWidgetAgentsByIds(
    supabase,
    widget.workspace_id,
    orderedDraftAgents.map((agent) => agent.agentId),
  );
  const agentMap = new Map(referencedAgents.map((agent) => [agent.id, agent]));

  return orderedDraftAgents
    .map((agent, index) => {
      const loadedAgent = agentMap.get(agent.agentId);
      if (!loadedAgent) {
        return null;
      }

      return {
        widgetAgentId: buildDraftPreviewWidgetAgentId(agent.agentId, index),
        persistedWidgetAgentId: null,
        publishedVersionId: loadedAgent.published_version_id,
        agent: loadedAgent,
      } satisfies RuntimeWidgetAgentSelection;
    })
    .filter(Boolean) as RuntimeWidgetAgentSelection[];
}

export async function upsertWidgetSession(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    source: WidgetSessionRecord["source"];
    pageUrl?: string | null;
    referrer?: string | null;
    origin?: string | null;
    activeWidgetAgentId?: string | null;
    activeAgentId?: string | null;
  },
) {
  const timestamp = new Date().toISOString();
  const payload: Record<string, string | null> = {
    widget_id: input.widgetId,
    session_id: input.sessionId,
    source: input.source,
    page_url: input.pageUrl ?? null,
    referrer: input.referrer ?? null,
    origin: input.origin ?? null,
    last_seen_at: timestamp,
  };

  if (input.activeWidgetAgentId !== undefined) {
    payload.active_widget_agent_id = input.activeWidgetAgentId;
  }

  if (input.activeAgentId !== undefined) {
    payload.active_agent_id = input.activeAgentId;
  }

  const { data, error } = await supabase
    .from("widget_sessions")
    .upsert(payload, { onConflict: "widget_id,session_id" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert widget session.");
  }

  return data as WidgetSessionRecord;
}

export async function loadWidgetSession(
  supabase: WidgetAdminSupabase,
  widgetId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("widget_sessions")
    .select("*")
    .eq("widget_id", widgetId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as WidgetSessionRecord | null;
}

export async function loadWidgetSessionHistory(
  supabase: WidgetAdminSupabase,
  widgetSessionId: string,
) {
  const { data, error } = await supabase
    .from("widget_session_messages")
    .select("*")
    .eq("widget_session_id", widgetSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows as WidgetSessionMessageRecord[];
}

export async function loadOrderedWidgetSessionHistory(
  supabase: WidgetAdminSupabase,
  widgetSessionId: string,
) {
  const orderedBuilder = supabase
    .from("widget_session_messages")
    .select<WidgetSessionMessageRecord>("*") as unknown as WidgetOrderedSelectBuilder<WidgetSessionMessageRecord>;
  const result = await orderedBuilder
    .eq("widget_session_id", widgetSessionId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (result.error) {
    throw new Error(result.error.message);
  }

  // result.data is already WidgetSessionMessageRecord[] from the typed builder.
  const rows = (result.data ?? []) as unknown as WidgetSessionMessageRecord[];
  rows.reverse();
  return rows;
}

export async function insertWidgetMessages(
  supabase: WidgetAdminSupabase,
  input: {
    widgetSessionId: string;
    widgetId: string;
    widgetAgentId: string | null;
    agentId: string | null;
    messages: Array<{
      role: WidgetSessionMessageRecord["role"];
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  if (input.messages.length === 0) {
    return;
  }

  const { error } = await supabase.from("widget_session_messages").insert(
    input.messages.map((message) => ({
      widget_session_id: input.widgetSessionId,
      widget_id: input.widgetId,
      widget_agent_id: input.widgetAgentId,
      agent_id: input.agentId,
      role: message.role,
      content: message.content,
      metadata: message.metadata ?? {},
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertWidgetLead(
  supabase: WidgetAdminSupabase,
  input: Omit<WidgetLeadRecord, "id" | "created_at">,
) {
  const { data, error } = await supabase
    .from("widget_leads")
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create widget lead.");
  }

  return data as WidgetLeadRecord;
}

export function getPreviewTokenSecret() {
  const configuredSecret =
    process.env.WIDGET_PREVIEW_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local-widget-preview-secret";
  }

  return null;
}

export async function signWidgetPreviewToken(payload: Record<string, unknown>) {
  const secret = getPreviewTokenSecret();

  if (!secret) {
    throw new Error(
      "WIDGET_PREVIEW_SECRET is missing. Set it in production to enable widget preview tokens.",
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const body = btoa(JSON.stringify(payload));
  const mac = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${body}.${mac}`;
}

export async function verifyWidgetPreviewToken(
  token: string | null,
  expectedWidgetPublicKey: string,
) {
  if (!token) {
    return false;
  }

  const secret = getPreviewTokenSecret();

  if (!secret) {
    return false;
  }

  const [encodedPayload, encodedMac] = token.split(".");

  if (!encodedPayload || !encodedMac) {
    return null;
  }

  let payloadJson: string;
  let payload: WidgetPreviewTokenPayload;

  try {
    payloadJson = atob(encodedPayload);
    payload = JSON.parse(payloadJson) as WidgetPreviewTokenPayload;
  } catch {
    return null;
  }

  if (payload.widgetPublicKey !== expectedWidgetPublicKey) {
    return null;
  }

  if (
    typeof payload.expiresAt !== "number" ||
    typeof payload.issuedAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const macBytes = Uint8Array.from(atob(encodedMac), (char) => char.charCodeAt(0));
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    macBytes,
    encoder.encode(payloadJson),
  );

  return isValid ? payload : null;
}

export function buildWidgetPreviewPayload(input: {
  widgetPublicKey: string;
  widgetId: string;
  workspaceId: string;
  userId: string;
  revision?: string;
  expiresInMs?: number;
}) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.expiresInMs ?? WIDGET_PREVIEW_TTL_MS);

  return {
    widgetPublicKey: input.widgetPublicKey,
    widgetId: input.widgetId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    revision: input.revision,
    appUrl: getAppUrl(),
    widgetUrl: getWidgetAppUrl(),
    issuedAt,
    expiresAt,
  };
}
