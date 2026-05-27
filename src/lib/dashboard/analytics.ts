import type { SupabaseClient } from "@supabase/supabase-js";
import { buildConversationDetailForViewer } from "@/lib/debug-trace-security";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsOverview,
  DashboardAnalyticsRange,
  DashboardConversationDetailResponse,
  DashboardLatestActivityResponse,
  DebugEvent,
  DebugTrace,
  WorkspaceMemberRecord,
} from "@/lib/types";

type AdminSupabase = Pick<SupabaseClient, "from">;

interface AnalyticsWidgetRow {
  id: string;
  name: string;
  status: "draft" | "deployed";
  widget_public_key: string;
}

interface AnalyticsAgentRow {
  id: string;
  name: string;
}

interface AnalyticsWidgetAgentRow {
  id: string;
  widget_id: string;
  agent_id: string;
  label: string;
}

interface AnalyticsWidgetSessionRow {
  id: string;
  widget_id: string;
  session_id: string;
  source: "embedded" | "hosted" | "preview";
  page_url: string | null;
  referrer: string | null;
  active_widget_agent_id: string | null;
  active_agent_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status?: "active" | "completed";
  ended_at?: string | null;
}

interface AnalyticsTranscriptRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface DashboardConversationSummaryRow {
  widget_session_id: string;
  workspace_id: string;
  widget_id: string;
  session_id: string;
  active_agent_id: string | null;
  active_widget_agent_id: string | null;
  source: "embedded" | "hosted";
  status: "active" | "completed";
  first_seen_at: string;
  last_activity_at: string;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  latest_snippet: string | null;
  lead_count: number;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  page_url: string | null;
  referrer: string | null;
}

interface DashboardConversationAggregationResult {
  widgetOptions: Array<{ id: string; name: string; status: "draft" | "deployed" }>;
  agentOptions: Array<{ id: string; name: string }>;
  overview: {
    conversationCount: number;
    messageCount: number;
    leadCount: number;
    activeWidgetIds: string[];
  };
  conversations: DashboardAnalyticsConversationListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

interface DashboardConversationQueryInput {
  workspaceId: string;
  appliedFilters: DashboardAnalyticsAppliedFilters;
  cursor: string | null;
  limit: number;
}

interface DashboardCursorPayload {
  lastActivityAt: string;
  widgetSessionId: string;
}

interface AnalyticsIdentitySummary {
  name: string | null;
  email: string | null;
  phone: string | null;
}

const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const STRUCTURED_NAME_PATTERN =
  /\b(?:name|namn)\s*[:\-]\s*([^\n,]+?)(?=(?:\s+(?:email|e-post|mail)\b)|$)/i;
const INTRO_NAME_PATTERN =
  /\b(?:my name is|this is|jag heter|mitt namn är)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,79})/i;
const DASHBOARD_CONVERSATION_SUMMARY_SELECT =
  "widget_session_id, workspace_id, widget_id, session_id, active_agent_id, active_widget_agent_id, source, status, first_seen_at, last_activity_at, message_count, user_message_count, assistant_message_count, latest_snippet, lead_count, lead_name, lead_email, lead_phone, page_url, referrer";

function normalizeLimit(limit: number | null | undefined) {
  if (!limit || Number.isNaN(limit)) {
    return 25;
  }

  return Math.min(Math.max(limit, 1), 50);
}

function normalizeIdentityName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/[.!?;,:\-–—]+$/, "")
    .trim();

  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  if (EMAIL_PATTERN.test(normalized) || /\d/.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractIdentityFromText(content: string | null | undefined) {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  const emailMatch = normalized.match(EMAIL_PATTERN);
  const structuredNameMatch = normalized.match(STRUCTURED_NAME_PATTERN);
  const introNameMatch = normalized.match(INTRO_NAME_PATTERN);
  const name =
    normalizeIdentityName(structuredNameMatch?.[1]) ??
    normalizeIdentityName(introNameMatch?.[1]);
  const email = emailMatch?.[0]?.trim().toLowerCase() ?? null;

  if (!name && !email) {
    return null;
  }

  return {
    name,
    email,
    phone: null,
  } satisfies AnalyticsIdentitySummary;
}

function buildDisplayIdentitySummary(summary: AnalyticsIdentitySummary | null) {
  if (!summary) {
    return null;
  }

  if (summary.name || summary.email || summary.phone) {
    return summary;
  }

  return null;
}

function compareConversationRows(
  left: DashboardAnalyticsConversationListItem,
  right: DashboardAnalyticsConversationListItem,
) {
  if (left.lastActivityAt !== right.lastActivityAt) {
    return right.lastActivityAt.localeCompare(left.lastActivityAt);
  }

  return right.widgetSessionId.localeCompare(left.widgetSessionId);
}

export function getAnalyticsDateRange(range: DashboardAnalyticsRange) {
  const now = new Date();
  const start = new Date(now);
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  start.setDate(start.getDate() - days);

  return {
    start,
    startIso: start.toISOString(),
  };
}

export function encodeAnalyticsCursor(payload: DashboardCursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeAnalyticsCursor(cursor: string | null) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as DashboardCursorPayload;

    if (
      typeof decoded.lastActivityAt !== "string" ||
      typeof decoded.widgetSessionId !== "string"
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function buildSyntheticDebugTraceFromToolMessages(
  toolMessages: AnalyticsTranscriptRow[],
  assistantCreatedAt: string,
): DebugTrace | null {
  if (toolMessages.length === 0) {
    return null;
  }

  const firstToolTimestamp = Date.parse(toolMessages[0].created_at);
  const assistantTimestamp = Date.parse(assistantCreatedAt);
  const hasValidTimeline =
    Number.isFinite(firstToolTimestamp) &&
    Number.isFinite(assistantTimestamp) &&
    assistantTimestamp >= firstToolTimestamp;

  const events: DebugEvent[] = toolMessages.map((message, index) => {
    const metadata = message.metadata ?? {};
    const toolName =
      typeof metadata.name === "string" && metadata.name.trim()
        ? metadata.name.trim()
        : "unknown";
    const metadataError =
      typeof metadata.error === "string" && metadata.error.trim()
        ? metadata.error.trim()
        : null;
    const createdAtTimestamp = Date.parse(message.created_at);
    const eventTimestamp =
      hasValidTimeline && Number.isFinite(createdAtTimestamp)
        ? Math.max(0, createdAtTimestamp - firstToolTimestamp)
        : index * 50;
    const redactedResult =
      typeof message.content === "string" && message.content.trim()
        ? message.content.trim()
        : undefined;

    if (metadataError) {
      return {
        type: "tool_error",
        ts: eventTimestamp,
        name: toolName,
        error: metadataError,
      };
    }

    return {
      type: "tool_result",
      ts: eventTimestamp,
      name: toolName,
      result: redactedResult,
    };
  });

  const firstErrorEvent = events.find(
    (event): event is DebugEvent & { error: string } =>
      event.type === "tool_error" && typeof event.error === "string",
  );

  return {
    durationMs: hasValidTimeline ? assistantTimestamp - firstToolTimestamp : 0,
    iterationsUsed: 1,
    toolsAvailable: Array.from(
      new Set(
        toolMessages
          .map((message) => {
            const name = message.metadata?.name;
            return typeof name === "string" && name.trim() ? name.trim() : null;
          })
          .filter((name): name is string => Boolean(name)),
      ),
    ),
    knowledgeHits: 0,
    events,
    hadError: Boolean(firstErrorEvent),
    errorSummary: firstErrorEvent?.error,
  };
}

function buildTranscriptWithDebugTrace(messages: AnalyticsTranscriptRow[]) {
  const transcript: DashboardConversationDetailResponse["transcript"] = [];
  let pendingToolMessages: AnalyticsTranscriptRow[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      pendingToolMessages.push(message);
      continue;
    }

    if (message.role === "user") {
      pendingToolMessages = [];
      transcript.push({
        id: message.id,
        role: "user",
        content: message.content,
        createdAt: message.created_at,
        metadata: message.metadata,
        debugTrace: null,
      });
      continue;
    }

    if (message.role !== "assistant") {
      pendingToolMessages = [];
      continue;
    }

    const debugTraceFromMetadata =
      message.metadata?.debugTrace &&
      typeof message.metadata.debugTrace === "object"
        ? (message.metadata.debugTrace as DebugTrace)
        : null;

    transcript.push({
      id: message.id,
      role: "assistant",
      content: message.content,
      createdAt: message.created_at,
      metadata: message.metadata,
      debugTrace:
        debugTraceFromMetadata ??
        buildSyntheticDebugTraceFromToolMessages(
          pendingToolMessages,
          message.created_at,
        ),
    });
    pendingToolMessages = [];
  }

  return transcript;
}

export async function listWorkspaceWidgetsForAnalytics(
  supabase: AdminSupabase,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("widgets")
    .select("id, name, status, widget_public_key")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AnalyticsWidgetRow[];
}

export async function listWorkspaceAgentsForAnalytics(
  supabase: AdminSupabase,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("surface", "widget")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AnalyticsAgentRow[];
}

async function buildConversationRowsFromSummaries(
  supabase: AdminSupabase,
  input: {
    widgets: AnalyticsWidgetRow[];
    agents: AnalyticsAgentRow[];
    summaries: DashboardConversationSummaryRow[];
  },
) {
  const widgetById = new Map(input.widgets.map((widget) => [widget.id, widget]));
  const agentById = new Map(input.agents.map((agent) => [agent.id, agent]));
  const sessionWidgetIds = Array.from(
    new Set(input.summaries.map((summary) => summary.widget_id)),
  );
  const widgetAgents = await loadWidgetAgentsForWidgets(supabase, sessionWidgetIds);
  const widgetAgentById = new Map(
    widgetAgents.map((widgetAgent) => [widgetAgent.id, widgetAgent]),
  );
  const widgetAgentByCompositeKey = new Map(
    widgetAgents.map((widgetAgent) => [
      `${widgetAgent.widget_id}:${widgetAgent.agent_id}`,
      widgetAgent,
    ]),
  );

  return input.summaries
    .map((summary) => {
      const widget = widgetById.get(summary.widget_id);
      if (!widget) {
        return null;
      }

      const widgetAgent =
        (summary.active_widget_agent_id
          ? widgetAgentById.get(summary.active_widget_agent_id)
          : null) ??
        (summary.active_agent_id
          ? widgetAgentByCompositeKey.get(
              `${summary.widget_id}:${summary.active_agent_id}`,
            ) ?? null
          : null);
      const agent = summary.active_agent_id
        ? agentById.get(summary.active_agent_id) ?? null
        : null;
      const leadSummary =
        summary.lead_count > 0
          ? {
              name: summary.lead_name,
              email: summary.lead_email,
              phone: summary.lead_phone,
            }
          : null;
      const identitySummary = buildDisplayIdentitySummary(leadSummary);

      return {
        widgetSessionId: summary.widget_session_id,
        sessionId: summary.session_id,
        widgetId: summary.widget_id,
        widgetName: widget.name,
        widgetPublicKey: widget.widget_public_key,
        widgetAgentId: widgetAgent?.id ?? summary.active_widget_agent_id ?? null,
        agentId: summary.active_agent_id ?? null,
        agentName: agent?.name ?? null,
        agentLabel: agent?.name ?? widgetAgent?.label ?? null,
        source: summary.source,
        startedAt: summary.first_seen_at,
        lastActivityAt: summary.last_activity_at,
        messageCount: summary.message_count,
        userMessageCount: summary.user_message_count,
        assistantMessageCount: summary.assistant_message_count,
        latestSnippet: summary.latest_snippet,
        pageUrl: summary.page_url,
        referrer: summary.referrer,
        hasLead: summary.lead_count > 0,
        leadCount: summary.lead_count,
        leadSummary,
        identitySummary,
      } satisfies DashboardAnalyticsConversationListItem;
    })
    .filter(Boolean) as DashboardAnalyticsConversationListItem[];
}

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`).toLowerCase();
}

function applySummaryRowFilters(
  // Supabase's fluent builder type becomes excessively deep when shared across helpers.
  // Keep this helper structurally typed and let call sites cast result rows explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  input: {
    workspaceId: string;
    startIso: string;
    widgetId: string | null;
    agentId: string | null;
    search: string;
    sessionStatus: "all" | "active" | "completed";
  },
) {
  let nextQuery = query
    .eq("workspace_id", input.workspaceId)
    .gte("last_activity_at", input.startIso);

  if (input.widgetId) {
    nextQuery = nextQuery.eq("widget_id", input.widgetId);
  }

  if (input.agentId) {
    nextQuery = nextQuery.eq("active_agent_id", input.agentId);
  }

  if (input.sessionStatus !== "all") {
    nextQuery = nextQuery.eq("status", input.sessionStatus);
  }

  if (input.search) {
    nextQuery = nextQuery.ilike(
      "search_text",
      `%${escapeIlikePattern(input.search)}%`,
    );
  }

  return nextQuery;
}

async function fetchAllMatchingSummaryRows(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    widgetId: string | null;
    agentId: string | null;
    search: string;
    sessionStatus: "all" | "active" | "completed";
  },
) {
  const pageSize = 1000;
  const rows: DashboardConversationSummaryRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = applySummaryRowFilters(
      supabase
        .from("dashboard_conversation_summaries")
        .select(DASHBOARD_CONVERSATION_SUMMARY_SELECT)
        .order("last_activity_at", { ascending: false })
        .order("widget_session_id", { ascending: false })
        .range(offset, offset + pageSize - 1),
      input,
    );
    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as DashboardConversationSummaryRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchPagedSummaryRows(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    widgetId: string | null;
    agentId: string | null;
    search: string;
    sessionStatus: "all" | "active" | "completed";
    cursor: string | null;
    limit: number;
  },
) {
  let query = applySummaryRowFilters(
    supabase
      .from("dashboard_conversation_summaries")
      .select(DASHBOARD_CONVERSATION_SUMMARY_SELECT)
      .order("last_activity_at", { ascending: false })
      .order("widget_session_id", { ascending: false }),
    input,
  );
  const decodedCursor = decodeAnalyticsCursor(input.cursor);

  if (decodedCursor) {
    query = query.or(
      `last_activity_at.lt.${decodedCursor.lastActivityAt},and(last_activity_at.eq.${decodedCursor.lastActivityAt},widget_session_id.lt.${decodedCursor.widgetSessionId})`,
    );
  }

  const { data, error } = await query.limit(input.limit + 1);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DashboardConversationSummaryRow[];
}

export async function listRecentDashboardConversations(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    range?: DashboardAnalyticsRange;
    limit: number;
  },
) {
  const { startIso } = getAnalyticsDateRange(input.range ?? "30d");
  const [widgets, agents] = await Promise.all([
    listWorkspaceWidgetsForAnalytics(supabase, input.workspaceId),
    listWorkspaceAgentsForAnalytics(supabase, input.workspaceId),
  ]);

  if (widgets.length === 0) {
    return [];
  }

  const activeWidgets = widgets.filter((widget) => widget.status === "deployed");

  if (activeWidgets.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("dashboard_conversation_summaries")
    .select(DASHBOARD_CONVERSATION_SUMMARY_SELECT)
    .in("widget_id", activeWidgets.map((widget) => widget.id))
    .gte("last_activity_at", startIso)
    .order("last_activity_at", { ascending: false })
    .order("widget_session_id", { ascending: false })
    .limit(normalizeLimit(input.limit));

  if (error) {
    throw new Error(error.message);
  }

  const summaries = (data ?? []) as DashboardConversationSummaryRow[];

  if (summaries.length === 0) {
    return [];
  }

  const rows = await buildConversationRowsFromSummaries(supabase, {
    widgets: activeWidgets,
    agents,
    summaries,
  });

  return rows.sort(compareConversationRows);
}

export async function getDashboardLatestActivity(
  supabase: AdminSupabase,
  workspaceId: string,
): Promise<DashboardLatestActivityResponse> {
  const [latest] = await listRecentDashboardConversations(supabase, {
    workspaceId,
    range: "30d",
    limit: 1,
  });

  if (!latest) {
    return { latestConversation: null };
  }

  return {
    latestConversation: {
      widgetSessionId: latest.widgetSessionId,
      widgetId: latest.widgetId,
      widgetName: latest.widgetName,
      agentId: latest.agentId,
      agentName: latest.agentName,
      agentLabel: latest.agentLabel,
      latestSnippet: latest.latestSnippet,
      lastActivityAt: latest.lastActivityAt,
    },
  };
}

async function loadWidgetAgentsForWidgets(
  supabase: AdminSupabase,
  widgetIds: string[],
) {
  if (widgetIds.length === 0) {
    return [] as AnalyticsWidgetAgentRow[];
  }

  const { data, error } = await supabase
    .from("widget_agents")
    .select("id, widget_id, agent_id, label")
    .in("widget_id", widgetIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AnalyticsWidgetAgentRow[];
}

export async function getDashboardAnalyticsOverview(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    conversationCount: number;
    messageCount: number;
    leadCount: number;
    activeWidgetIds: string[];
  },
): Promise<DashboardAnalyticsOverview> {
  const [agentsResult, connectionsResult, failuresResult] = await Promise.all([
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .is("archived_at", null),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("status", "connected"),
    supabase
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("status", "failed")
      .gte("created_at", input.startIso),
  ]);

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message);
  }

  if (connectionsResult.error) {
    throw new Error(connectionsResult.error.message);
  }

  if (failuresResult.error) {
    throw new Error(failuresResult.error.message);
  }

  return {
    conversations: input.conversationCount,
    messages: input.messageCount,
    leads: input.leadCount,
    activeWidgets: new Set(input.activeWidgetIds).size,
    agents: agentsResult.count ?? 0,
    connectedApps: connectionsResult.count ?? 0,
    failures: failuresResult.count ?? 0,
  };
}

export async function listDashboardConversations(
  supabase: AdminSupabase,
  input: DashboardConversationQueryInput,
): Promise<DashboardConversationAggregationResult> {
  const { startIso } = getAnalyticsDateRange(input.appliedFilters.range);
  const [widgets, agents] = await Promise.all([
    listWorkspaceWidgetsForAnalytics(supabase, input.workspaceId),
    listWorkspaceAgentsForAnalytics(supabase, input.workspaceId),
  ]);

  const widgetOptions = widgets.map((widget) => ({
    id: widget.id,
    name: widget.name,
    status: widget.status,
  }));
  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
  }));

  if (
    input.appliedFilters.widgetId &&
    !widgets.some((widget) => widget.id === input.appliedFilters.widgetId)
  ) {
    return {
      widgetOptions,
      agentOptions,
      overview: {
        conversationCount: 0,
        messageCount: 0,
        leadCount: 0,
        activeWidgetIds: [],
      },
      conversations: [],
      pageInfo: {
        nextCursor: null,
        hasMore: false,
      },
    };
  }

  const limit = normalizeLimit(input.limit);
  const [matchingSummaries, pagedSummaries] = await Promise.all([
    fetchAllMatchingSummaryRows(supabase, {
      workspaceId: input.workspaceId,
      widgetId: input.appliedFilters.widgetId,
      agentId: input.appliedFilters.agentId,
      search: input.appliedFilters.search,
      sessionStatus: input.appliedFilters.sessionStatus,
      startIso,
    }),
    fetchPagedSummaryRows(supabase, {
      workspaceId: input.workspaceId,
      widgetId: input.appliedFilters.widgetId,
      agentId: input.appliedFilters.agentId,
      search: input.appliedFilters.search,
      sessionStatus: input.appliedFilters.sessionStatus,
      cursor: input.cursor,
      limit,
      startIso,
    }),
  ]);

  if (matchingSummaries.length === 0) {
    return {
      widgetOptions,
      agentOptions,
      overview: {
        conversationCount: 0,
        messageCount: 0,
        leadCount: 0,
        activeWidgetIds: [],
      },
      conversations: [],
      pageInfo: {
        nextCursor: null,
        hasMore: false,
      },
    };
  }

  const widgetStatusById = new Map(widgets.map((widget) => [widget.id, widget.status]));
  const pageRows = await buildConversationRowsFromSummaries(supabase, {
    widgets,
    agents,
    summaries: pagedSummaries,
  });
  const conversations = pageRows.sort(compareConversationRows).slice(0, limit);
  const hasMore = pagedSummaries.length > limit;
  const lastRow = conversations[conversations.length - 1];
  const activeWidgetIds = Array.from(
    new Set(
      matchingSummaries
        .filter((summary) => widgetStatusById.get(summary.widget_id) === "deployed")
        .map((summary) => summary.widget_id),
    ),
  );

  return {
    widgetOptions,
    agentOptions,
    overview: {
      conversationCount: matchingSummaries.length,
      messageCount: matchingSummaries.reduce(
        (sum, summary) => sum + summary.message_count,
        0,
      ),
      leadCount: matchingSummaries.reduce(
        (sum, summary) => sum + summary.lead_count,
        0,
      ),
      activeWidgetIds,
    },
    conversations,
    pageInfo: {
      nextCursor:
        hasMore && lastRow
          ? encodeAnalyticsCursor({
              lastActivityAt: lastRow.lastActivityAt,
              widgetSessionId: lastRow.widgetSessionId,
            })
          : null,
      hasMore,
    },
  };
}

export async function getDashboardConversationDetail(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    widgetSessionId: string;
    viewerRole: WorkspaceMemberRecord["role"];
  },
): Promise<DashboardConversationDetailResponse | null> {
  const { data: sessionData, error: sessionError } = await supabase
    .from("widget_sessions")
    .select(
      "id, widget_id, session_id, source, page_url, referrer, active_widget_agent_id, active_agent_id, first_seen_at, last_seen_at",
    )
    .eq("id", input.widgetSessionId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const session = (sessionData ?? null) as AnalyticsWidgetSessionRow | null;

  if (!session || session.source === "preview") {
    return null;
  }

  const { data: widgetData, error: widgetError } = await supabase
    .from("widgets")
    .select("id, workspace_id, name, widget_public_key")
    .eq("id", session.widget_id)
    .maybeSingle();

  if (widgetError) {
    throw new Error(widgetError.message);
  }

  const widget = widgetData as
    | (AnalyticsWidgetRow & { workspace_id: string })
    | null;

  if (!widget || widget.workspace_id !== input.workspaceId) {
    return null;
  }

  const [widgetAgents, agentResult, transcriptData, leadData] = await Promise.all([
    loadWidgetAgentsForWidgets(supabase, [widget.id]),
    session.active_agent_id
      ? supabase
          .from("agents")
          .select("id, name")
          .eq("id", session.active_agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("widget_session_messages")
      .select("id, role, content, metadata, created_at")
      .eq("widget_session_id", session.id)
      .in("role", ["user", "assistant", "tool"])
      .order("created_at", { ascending: true }),
    supabase
      .from("widget_leads")
      .select("id, name, email, phone, message, created_at")
      .eq("widget_session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (agentResult.error) {
    throw new Error(agentResult.error.message);
  }

  if (transcriptData.error) {
    throw new Error(transcriptData.error.message);
  }

  if (leadData.error) {
    throw new Error(leadData.error.message);
  }

  const widgetAgent =
    (session.active_widget_agent_id
      ? widgetAgents.find((item) => item.id === session.active_widget_agent_id) ?? null
      : null) ??
    (session.active_agent_id
      ? widgetAgents.find((item) => item.agent_id === session.active_agent_id) ?? null
      : null);

  const agent = (agentResult.data ?? null) as AnalyticsAgentRow | null;
  const transcriptRows = (transcriptData.data ?? []) as AnalyticsTranscriptRow[];
  let inferredIdentitySummary: AnalyticsIdentitySummary | null = null;

  for (const message of [...transcriptRows].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    inferredIdentitySummary = extractIdentityFromText(message.content);

    if (inferredIdentitySummary) {
      break;
    }
  }

  const resolvedIdentitySummary = buildDisplayIdentitySummary(inferredIdentitySummary);
  const leadSummary = leadData.data
    ? {
        name: leadData.data.name,
        email: leadData.data.email,
        phone: leadData.data.phone,
      }
    : null;

  return buildConversationDetailForViewer({
    conversation: {
      widgetSessionId: session.id,
      sessionId: session.session_id,
      widgetId: widget.id,
      widgetName: widget.name,
      widgetPublicKey: widget.widget_public_key,
      widgetAgentId: widgetAgent?.id ?? session.active_widget_agent_id ?? null,
      agentId: session.active_agent_id ?? null,
      agentName: agent?.name ?? null,
      agentLabel: agent?.name ?? widgetAgent?.label ?? null,
      source: session.source === "hosted" ? "hosted" : "embedded",
      startedAt: session.first_seen_at,
      lastActivityAt: session.last_seen_at,
      pageUrl: session.page_url,
      referrer: session.referrer,
    },
    lead: leadData.data
      ? {
          id: leadData.data.id,
          name: leadData.data.name,
          email: leadData.data.email,
          phone: leadData.data.phone,
          message: leadData.data.message,
          createdAt: leadData.data.created_at,
        }
      : null,
    identitySummary: buildDisplayIdentitySummary(leadSummary ?? resolvedIdentitySummary),
    transcript: buildTranscriptWithDebugTrace(
      transcriptRows,
    ),
  }, input.viewerRole);
}
