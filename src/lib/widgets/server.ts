import type { NextRequest } from "next/server";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { getAppUrl, getWidgetAppUrl } from "@/lib/env";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { extractCalSelectionFromDefinition } from "@/lib/cal";
import type {
  AgentRecord,
  AgentVersionRecord,
  BuilderDefinition,
  CalSelection,
  ConversationEndReason,
  EndChatPolicy,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
  WidgetDraftPreviewInput,
  WidgetAgentRecord,
  WidgetLeadRecord,
  WidgetPreviewDraftRecord,
  WidgetRecord,
  WidgetSessionMessageRecord,
  WidgetSessionRecord,
} from "@/lib/types";
import {
  buildAllowedOriginHeaders,
  buildWidgetCorsHeaders,
  getRequestOrigin,
  normalizeAllowedOrigin,
  normalizeAllowedOrigins,
} from "@/lib/widgets/http";
import {
  buildDraftPreviewWidgetAgentId,
  buildHostedWidgetUrl,
  buildWidgetEmbedSnippet,
  buildWidgetRuntimeConfig,
  buildWidgetRuntimeConfigFromDraft,
  type WidgetAgentWithAgent,
} from "@/lib/widgets";

interface WidgetQueryResult<TData> {
  data?: TData | null;
  error?: { message: string } | null;
}

interface WidgetRpcQueryResult<TData> {
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

interface WidgetUpdateBuilder<TData> {
  eq: (column: string, value: string) => Promise<WidgetQueryResult<TData>>;
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
  update: (values: Record<string, unknown>) => WidgetUpdateBuilder<unknown>;
}

export interface WidgetAdminSupabase {
  from: (table: string) => WidgetTableQuery;
  rpc: <TData = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<WidgetRpcQueryResult<TData>>;
}

interface WidgetPreviewDraftRow extends WidgetPreviewDraftRecord {
  payload: WidgetDraftPreviewInput;
}

interface AgentDraftDefinitionRow {
  agent_id: string;
  definition: BuilderDefinition | null;
}

interface AgentVersionDefinitionRow {
  id: string;
  definition: BuilderDefinition | null;
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

export interface WidgetAccessTokenPayload {
  widgetPublicKey: string;
  widgetId: string;
  source: "embedded" | "hosted";
  allowedOrigin: string | null;
  issuedAt: number;
  expiresAt: number;
}

export interface RuntimeWidgetAgentSelection {
  widgetAgentId: string;
  persistedWidgetAgentId: string | null;
  publishedVersionId: string | null;
  agent: AgentRecord;
}

const WIDGET_PREVIEW_TTL_MS = 15 * 60 * 1000;
const WIDGET_ACCESS_TTL_MS = 15 * 60 * 1000;
const WIDGET_ACTIVE_TURN_STALE_MS = 10 * 60 * 1000;
const DEPLOY_TIMESTAMP_SKEW_MS = 2000;

export { buildWidgetCorsHeaders, getRequestOrigin };

interface WidgetSessionTurnLockRow {
  widget_session_id: string | null;
  status: WidgetSessionRecord["status"] | null;
  active_turn_request_id: string | null;
  active_turn_started_at: string | null;
  acquired: boolean;
}

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

function getWidgetHostedOrigin() {
  return normalizeAllowedOrigin(getWidgetAppUrl());
}

function getSignedTokenSecret(
  envValue: string | undefined,
  fallbackValue: string,
) {
  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  if (process.env.NODE_ENV !== "production") {
    return fallbackValue;
  }

  return null;
}

function decodeBase64Json<T>(value: string) {
  try {
    return JSON.parse(atob(value)) as T;
  } catch {
    return null;
  }
}

async function signSignedToken(payload: object, secret: string) {
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

async function verifySignedToken<T>(token: string | null, secret: string) {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedMac] = token.split(".");

  if (!encodedPayload || !encodedMac) {
    return null;
  }

  const payload = decodeBase64Json<T>(encodedPayload);

  if (!payload) {
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
  const macBytes = Uint8Array.from(atob(encodedMac), (char) =>
    char.charCodeAt(0),
  );
  const payloadJson = atob(encodedPayload);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    macBytes,
    encoder.encode(payloadJson),
  );

  return isValid ? payload : null;
}

function getWidgetRuntimeAllowedOrigins() {
  const runtimeOrigin = normalizeAllowedOrigin(getWidgetAppUrl());
  const origins = new Set<string>();

  if (runtimeOrigin) {
    origins.add(runtimeOrigin);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }

  return Array.from(origins);
}

export function resolveWidgetRuntimeRequestOrigin(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const allowedOrigins = getWidgetRuntimeAllowedOrigins();

  if (!requestOrigin) {
    return {
      ok: false as const,
      status: 403,
      error: "Runtime request origin is missing.",
      code: "WIDGET_RUNTIME_ORIGIN_REQUIRED",
    };
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    return {
      ok: false as const,
      status: 403,
      error: "Runtime request origin is not allowed.",
      code: "WIDGET_RUNTIME_ORIGIN_INVALID",
    };
  }

  return {
    ok: true as const,
    origin: requestOrigin,
  };
}

export function buildWidgetRuntimeCorsHeaders(request: NextRequest) {
  const requestOrigin = normalizeAllowedOrigin(request.headers.get("origin"));
  const allowedOrigins = getWidgetRuntimeAllowedOrigins();
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : null;

  return buildAllowedOriginHeaders(allowedOrigin);
}

export function buildWidgetBootstrapHeaders(
  request: NextRequest,
  options?: { preview?: boolean },
) {
  return {
    ...buildWidgetCorsHeaders(request),
    "Cache-Control": options?.preview
      ? "no-store, no-cache, must-revalidate"
      : "public, max-age=60, stale-while-revalidate=300",
  };
}

export function getWidgetAccessTokenSecret() {
  return getSignedTokenSecret(
    process.env.WIDGET_ACCESS_SECRET,
    "local-widget-access-secret",
  );
}

export function getPreviewTokenSecret() {
  return getSignedTokenSecret(
    process.env.WIDGET_PREVIEW_SECRET,
    "local-widget-preview-secret",
  );
}

export async function signWidgetAccessToken(payload: WidgetAccessTokenPayload) {
  const secret = getWidgetAccessTokenSecret();

  if (!secret) {
    throw new Error(
      "WIDGET_ACCESS_SECRET is missing. Set it in production to enable widget runtime access tokens.",
    );
  }

  return signSignedToken(payload, secret);
}

export async function verifyWidgetAccessToken(
  token: string | null,
  expectedWidgetPublicKey: string,
) {
  const secret = getWidgetAccessTokenSecret();

  if (!secret) {
    return null;
  }

  const payload = await verifySignedToken<WidgetAccessTokenPayload>(token, secret);

  if (!payload) {
    return null;
  }

  if (
    payload.widgetPublicKey !== expectedWidgetPublicKey ||
    typeof payload.widgetId !== "string" ||
    (payload.source !== "embedded" && payload.source !== "hosted") ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  if (
    payload.allowedOrigin !== null &&
    normalizeAllowedOrigin(payload.allowedOrigin) !== payload.allowedOrigin
  ) {
    return null;
  }

  return payload;
}

export function resolveWidgetBootstrapAccess(
  widget: WidgetRecord,
  request: NextRequest,
) {
  const requestOrigin = getRequestOrigin(request);
  const hostedOrigin = getWidgetHostedOrigin();

  if (requestOrigin && hostedOrigin && requestOrigin === hostedOrigin) {
    if (!widget.hosted_enabled) {
      return {
        ok: false as const,
        status: 403,
        error: "Hosted widget access is disabled.",
        code: "HOSTED_WIDGET_DISABLED",
      };
    }

    return {
      ok: true as const,
      source: "hosted" as const,
      allowedOrigin: null,
      origin: requestOrigin,
    };
  }

  const allowedOrigins = normalizeAllowedOrigins(widget.allowed_origins);

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      ok: true as const,
      source: "embedded" as const,
      allowedOrigin: requestOrigin,
      origin: requestOrigin,
    };
  }

  return {
    ok: false as const,
    status: 403,
    error: requestOrigin ? "Domain is not allowed." : "Request origin is missing.",
    code: requestOrigin ? "WIDGET_DOMAIN_NOT_ALLOWED" : "WIDGET_ORIGIN_REQUIRED",
  };
}

export async function resolveWidgetRuntimeAccess(args: {
  request: NextRequest;
  widget: WidgetRecord;
  preview: {
    isPreview: boolean;
    previewPayload: WidgetPreviewTokenPayload | null;
  };
}) {
  const { request, widget, preview } = args;

  if (preview.isPreview && preview.previewPayload) {
    return {
      ok: true as const,
      source: "preview" as const,
      origin: getRequestOrigin(request),
    };
  }

  const accessToken = await verifyWidgetAccessToken(
    request.headers.get("x-ag-widget-access-token"),
    widget.widget_public_key,
  );

  if (!accessToken || accessToken.widgetId !== widget.id) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing or invalid widget access token.",
      code: "WIDGET_ACCESS_TOKEN_INVALID",
    };
  }

  if (accessToken.source === "hosted") {
    if (!widget.hosted_enabled) {
      return {
        ok: false as const,
        status: 403,
        error: "Hosted widget access is disabled.",
        code: "HOSTED_WIDGET_DISABLED",
      };
    }

    return {
      ok: true as const,
      source: "hosted" as const,
      origin: getWidgetHostedOrigin(),
    };
  }

  const allowedOrigins = normalizeAllowedOrigins(widget.allowed_origins);

  if (!accessToken.allowedOrigin || !allowedOrigins.includes(accessToken.allowedOrigin)) {
    return {
      ok: false as const,
      status: 403,
      error: "Domain is not allowed.",
      code: "WIDGET_DOMAIN_NOT_ALLOWED",
    };
  }

  return {
    ok: true as const,
    source: "embedded" as const,
    origin: accessToken.allowedOrigin,
  };
}

function getTurnLockStaleThreshold(referenceTime = Date.now()) {
  return new Date(referenceTime - WIDGET_ACTIVE_TURN_STALE_MS).toISOString();
}

export function isWidgetSessionTurnLocked(
  session: Pick<
    WidgetSessionRecord,
    "active_turn_request_id" | "active_turn_started_at"
  > | null,
  referenceTime = Date.now(),
) {
  if (!session?.active_turn_request_id || !session.active_turn_started_at) {
    return false;
  }

  const startedAt = Date.parse(session.active_turn_started_at);

  if (Number.isNaN(startedAt)) {
    return false;
  }

  return startedAt >= referenceTime - WIDGET_ACTIVE_TURN_STALE_MS;
}

export async function acquireWidgetSessionTurnLock(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    requestId: string;
    startedAt?: string;
  },
) {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const { data, error } = await supabase.rpc<WidgetSessionTurnLockRow[]>(
    "acquire_widget_session_turn_lock",
    {
      p_widget_id: input.widgetId,
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
      p_started_at: startedAt,
      p_stale_before: getTurnLockStaleThreshold(Date.parse(startedAt)),
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;

  return {
    acquired: Boolean(row?.acquired),
    sessionStatus: row?.status ?? null,
    activeTurnRequestId: row?.active_turn_request_id ?? null,
    activeTurnStartedAt: row?.active_turn_started_at ?? null,
    startedAt,
  };
}

export async function releaseWidgetSessionTurnLock(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    requestId: string;
  },
) {
  const { data, error } = await supabase.rpc<boolean>(
    "release_widget_session_turn_lock",
    {
      p_widget_id: input.widgetId,
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
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
    timezone: config?.timezone ?? agent.timezone ?? 'UTC',
  };
}

async function loadAgentDraftDefinitionsByAgentId(
  supabase: WidgetAdminSupabase,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return new Map<string, BuilderDefinition>();
  }

  const { data, error } = await (supabase
    .from("agent_drafts")
    .select("agent_id, definition")
    .in("agent_id", agentIds) as unknown as Promise<{
    data: AgentDraftDefinitionRow[] | null;
    error: { message: string } | null;
  }>);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as AgentDraftDefinitionRow[])
      .filter((row) => row.definition)
      .map((row) => [row.agent_id, row.definition as BuilderDefinition]),
  );
}

async function loadAgentVersionDefinitionsById(
  supabase: WidgetAdminSupabase,
  versionIds: string[],
) {
  if (versionIds.length === 0) {
    return new Map<string, BuilderDefinition>();
  }

  const { data, error } = await (supabase
    .from("agent_versions")
    .select("id, definition")
    .in("id", versionIds) as unknown as Promise<{
    data: AgentVersionDefinitionRow[] | null;
    error: { message: string } | null;
  }>);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as AgentVersionDefinitionRow[])
      .filter((row) => row.definition)
      .map((row) => [row.id, row.definition as BuilderDefinition]),
  );
}

function buildAgentPolicyMapsFromVersionDefinitions(
  widgetAgents: WidgetAgentWithAgent[],
  definitionsByVersionId: Map<string, BuilderDefinition>,
) {
  const endChatPoliciesByAgentId = new Map<string, EndChatPolicy>();
  const gmailRecipientPoliciesByAgentId = new Map<string, GmailRecipientPolicy>();
  const googleCalendarSelectionsByAgentId = new Map<
    string,
    GoogleCalendarSelection
  >();
  const calSelectionsByAgentId = new Map<string, CalSelection>();

  for (const { widgetAgent, agent } of widgetAgents) {
    const definition = widgetAgent.published_version_id
      ? definitionsByVersionId.get(widgetAgent.published_version_id)
      : null;

    endChatPoliciesByAgentId.set(
      agent.id,
      extractEndChatPolicyFromDefinition(definition),
    );
    gmailRecipientPoliciesByAgentId.set(
      agent.id,
      extractGmailRecipientPolicyFromDefinition(definition),
    );
    googleCalendarSelectionsByAgentId.set(
      agent.id,
      extractGoogleCalendarSelectionFromDefinition(definition),
    );
    calSelectionsByAgentId.set(
      agent.id,
      extractCalSelectionFromDefinition(definition),
    );
  }

  return {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  };
}

function buildAgentPolicyMapsFromDraftDefinitions(
  agentIds: string[],
  definitionsByAgentId: Map<string, BuilderDefinition>,
) {
  const endChatPoliciesByAgentId = new Map<string, EndChatPolicy>();
  const gmailRecipientPoliciesByAgentId = new Map<string, GmailRecipientPolicy>();
  const googleCalendarSelectionsByAgentId = new Map<
    string,
    GoogleCalendarSelection
  >();
  const calSelectionsByAgentId = new Map<string, CalSelection>();

  for (const agentId of agentIds) {
    const definition = definitionsByAgentId.get(agentId);
    endChatPoliciesByAgentId.set(
      agentId,
      extractEndChatPolicyFromDefinition(definition),
    );
    gmailRecipientPoliciesByAgentId.set(
      agentId,
      extractGmailRecipientPolicyFromDefinition(definition),
    );
    googleCalendarSelectionsByAgentId.set(
      agentId,
      extractGoogleCalendarSelectionFromDefinition(definition),
    );
    calSelectionsByAgentId.set(
      agentId,
      extractCalSelectionFromDefinition(definition),
    );
  }

  return {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  };
}

async function buildStoredAgentPolicyMapsByAgentId(
  supabase: WidgetAdminSupabase,
  widgetAgents: WidgetAgentWithAgent[],
) {
  const versionIds = Array.from(
    new Set(
      widgetAgents
        .map(({ widgetAgent }) => widgetAgent.published_version_id)
        .filter(Boolean) as string[],
    ),
  );
  const definitionsByVersionId = await loadAgentVersionDefinitionsById(
    supabase,
    versionIds,
  );
  return buildAgentPolicyMapsFromVersionDefinitions(
    widgetAgents,
    definitionsByVersionId,
  );
}

async function buildDraftAgentPolicyMapsByAgentId(
  supabase: WidgetAdminSupabase,
  draft: WidgetDraftPreviewInput,
) {
  const agentIds = Array.from(new Set(draft.agents.map((agent) => agent.agentId)));
  const definitionsByAgentId = await loadAgentDraftDefinitionsByAgentId(
    supabase,
    agentIds,
  );
  return buildAgentPolicyMapsFromDraftDefinitions(agentIds, definitionsByAgentId);
}

export async function buildStoredWidgetRuntimeConfig(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
  options?: { preview?: boolean },
) {
  const {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  } = await buildStoredAgentPolicyMapsByAgentId(
    supabase,
    widgetAgents,
  );

  return buildWidgetRuntimeConfig(widget, widgetAgents, {
    preview: options?.preview,
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  });
}

export async function buildDraftWidgetRuntimeConfig(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  draft: WidgetDraftPreviewInput,
  options?: { preview?: boolean },
) {
  const {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  } = await buildDraftAgentPolicyMapsByAgentId(
    supabase,
    draft,
  );

  return buildWidgetRuntimeConfigFromDraft(widget, draft, {
    preview: options?.preview,
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  });
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

export async function updateWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  input: {
    draftId: string;
    payload: WidgetDraftPreviewInput;
    expiresAt: string;
  },
) {
  const { error } = await supabase
    .from("widget_preview_drafts")
    .update({
      payload: input.payload,
      expires_at: input.expiresAt,
    })
    .eq("id", input.draftId);

  if (error) {
    throw new Error(error.message || "Failed to update widget preview draft.");
  }
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

  const runtimeConfig = previewDraft
    ? await buildDraftWidgetRuntimeConfig(supabase, widget, previewDraft.payload, {
        preview: true,
      })
    : null;

  return {
    isPreview: true,
    previewPayload,
    previewDraft,
    runtimeConfig,
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
    status?: WidgetSessionRecord["status"];
    endedAt?: string | null;
    endReason?: ConversationEndReason | null;
    lastUserMessageAt?: string | null;
    lastAssistantMessageAt?: string | null;
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

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.endedAt !== undefined) {
    payload.ended_at = input.endedAt;
  }

  if (input.endReason !== undefined) {
    payload.end_reason = input.endReason;
  }

  if (input.lastUserMessageAt !== undefined) {
    payload.last_user_message_at = input.lastUserMessageAt;
  }

  if (input.lastAssistantMessageAt !== undefined) {
    payload.last_assistant_message_at = input.lastAssistantMessageAt;
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

export async function completeWidgetSession(
  supabase: WidgetAdminSupabase,
  input: {
    session: WidgetSessionRecord;
    reason: ConversationEndReason;
    completedAt?: string;
    lastAssistantMessageAt?: string | null;
  },
) {
  if (input.session.status === "completed") {
    return input.session;
  }

  const completedAt = input.completedAt ?? new Date().toISOString();

  return upsertWidgetSession(supabase, {
    widgetId: input.session.widget_id,
    sessionId: input.session.session_id,
    source: input.session.source,
    pageUrl: input.session.page_url,
    referrer: input.session.referrer,
    origin: input.session.origin,
    activeWidgetAgentId: input.session.active_widget_agent_id,
    activeAgentId: input.session.active_agent_id,
    status: "completed",
    endedAt: completedAt,
    endReason: input.reason,
    lastAssistantMessageAt:
      input.lastAssistantMessageAt ?? input.session.last_assistant_message_at,
  });
}

export async function handleConversationCompleted(input: {
  widget: WidgetRecord;
  session: WidgetSessionRecord;
  reason: ConversationEndReason;
}) {
  void input;
  // Future after-chat actions will attach here.
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

export async function signWidgetPreviewToken(payload: Record<string, unknown>) {
  const secret = getPreviewTokenSecret();

  if (!secret) {
    throw new Error(
      "WIDGET_PREVIEW_SECRET is missing. Set it in production to enable widget preview tokens.",
    );
  }

  return signSignedToken(payload, secret);
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

  const payload = await verifySignedToken<WidgetPreviewTokenPayload>(token, secret);

  if (!payload) {
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

  return payload;
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

export function buildWidgetAccessPayload(input: {
  widgetPublicKey: string;
  widgetId: string;
  source: "embedded" | "hosted";
  allowedOrigin: string | null;
  expiresInMs?: number;
}) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.expiresInMs ?? WIDGET_ACCESS_TTL_MS);

  return {
    widgetPublicKey: input.widgetPublicKey,
    widgetId: input.widgetId,
    source: input.source,
    allowedOrigin: input.allowedOrigin,
    issuedAt,
    expiresAt,
  } satisfies WidgetAccessTokenPayload;
}
