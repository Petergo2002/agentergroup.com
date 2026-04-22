import type { SupabaseClient } from "@supabase/supabase-js";
import { buildConversationDetailForViewer } from "@/lib/debug-trace-security";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsOverview,
  DashboardAnalyticsRange,
  DashboardConversationDetailResponse,
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
}

interface AnalyticsWidgetMessageRow {
  id: string;
  widget_session_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

interface AnalyticsTranscriptRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface AnalyticsWidgetLeadRow {
  id: string;
  widget_session_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  created_at: string;
}

interface DashboardConversationAggregationResult {
  widgetOptions: Array<{ id: string; name: string; status: "draft" | "deployed" }>;
  agentOptions: Array<{ id: string; name: string }>;
  filteredRows: DashboardAnalyticsConversationListItem[];
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

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeLimit(limit: number | null | undefined) {
  if (!limit || Number.isNaN(limit)) {
    return 25;
  }

  return Math.min(Math.max(limit, 1), 50);
}

function trimSnippet(content: string | null | undefined, maxLength = 120) {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
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

function matchesSearch(
  row: DashboardAnalyticsConversationListItem,
  search: string,
) {
  if (!search) {
    return true;
  }

  const haystack = [
    row.widgetName,
    row.agentLabel,
    row.agentName,
    row.latestSnippet,
    row.leadSummary?.name,
    row.leadSummary?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
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

async function fetchAllCandidateSessions(
  supabase: AdminSupabase,
  input: {
    widgetIds: string[];
    widgetId: string | null;
    agentId: string | null;
    startIso: string;
    sessionStatus: "all" | "active" | "completed";
  },
) {
  if (input.widgetIds.length === 0) {
    return [] as AnalyticsWidgetSessionRow[];
  }

  const pageSize = 1000;
  const rows: AnalyticsWidgetSessionRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("widget_sessions")
      .select(
        "id, widget_id, session_id, source, page_url, referrer, active_widget_agent_id, active_agent_id, first_seen_at, last_seen_at, status, ended_at",
      )
      .in("widget_id", input.widgetIds)
      .in("source", ["embedded", "hosted"])
      .gte("last_seen_at", input.startIso)
      .order("last_seen_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (input.widgetId) {
      query = query.eq("widget_id", input.widgetId);
    }

    if (input.agentId) {
      query = query.eq("active_agent_id", input.agentId);
    }

    if (input.sessionStatus !== "all") {
      query = query.eq("status", input.sessionStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as AnalyticsWidgetSessionRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return rows;
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

async function loadMessagesForSessions(
  supabase: AdminSupabase,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [] as AnalyticsWidgetMessageRow[];
  }

  const rows: AnalyticsWidgetMessageRow[] = [];

  for (const chunk of chunkArray(sessionIds, 200)) {
    const { data, error } = await supabase
      .from("widget_session_messages")
      .select("id, widget_session_id, role, content, created_at")
      .in("widget_session_id", chunk)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as AnalyticsWidgetMessageRow[]));
  }

  return rows;
}

async function loadLeadsForSessions(
  supabase: AdminSupabase,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [] as AnalyticsWidgetLeadRow[];
  }

  const rows: AnalyticsWidgetLeadRow[] = [];

  for (const chunk of chunkArray(sessionIds, 200)) {
    const { data, error } = await supabase
      .from("widget_leads")
      .select("id, widget_session_id, name, email, phone, message, created_at")
      .in("widget_session_id", chunk)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as AnalyticsWidgetLeadRow[]));
  }

  return rows;
}

export async function getDashboardAnalyticsOverview(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    filteredRows: DashboardAnalyticsConversationListItem[];
    widgetStatusById: Map<string, AnalyticsWidgetRow["status"]>;
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

  const activeWidgetIds = new Set(
    input.filteredRows
      .filter((row) => input.widgetStatusById.get(row.widgetId) === "deployed")
      .map((row) => row.widgetId),
  );

  return {
    conversations: input.filteredRows.length,
    messages: input.filteredRows.reduce(
      (sum, row) => sum + row.messageCount,
      0,
    ),
    leads: input.filteredRows.reduce((sum, row) => sum + row.leadCount, 0),
    activeWidgets: activeWidgetIds.size,
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
      filteredRows: [],
      conversations: [],
      pageInfo: {
        nextCursor: null,
        hasMore: false,
      },
    };
  }

  const candidateSessions = await fetchAllCandidateSessions(supabase, {
    widgetIds: widgets.map((widget) => widget.id),
    widgetId: input.appliedFilters.widgetId,
    agentId: input.appliedFilters.agentId,
    startIso,
    sessionStatus: input.appliedFilters.sessionStatus,
  });

  if (candidateSessions.length === 0) {
    return {
      widgetOptions,
      agentOptions,
      filteredRows: [],
      conversations: [],
      pageInfo: {
        nextCursor: null,
        hasMore: false,
      },
    };
  }

  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const widgetAgents = await loadWidgetAgentsForWidgets(
    supabase,
    Array.from(new Set(candidateSessions.map((session) => session.widget_id))),
  );
  const widgetAgentById = new Map(
    widgetAgents.map((widgetAgent) => [widgetAgent.id, widgetAgent]),
  );
  const widgetAgentByCompositeKey = new Map(
    widgetAgents.map((widgetAgent) => [
      `${widgetAgent.widget_id}:${widgetAgent.agent_id}`,
      widgetAgent,
    ]),
  );
  const sessionIds = candidateSessions.map((session) => session.id);
  const [messages, leads] = await Promise.all([
    loadMessagesForSessions(supabase, sessionIds),
    loadLeadsForSessions(supabase, sessionIds),
  ]);

  const messageSummaryBySessionId = new Map<
    string,
    {
      messageCount: number;
      userMessageCount: number;
      assistantMessageCount: number;
      latestSnippet: string | null;
      latestCreatedAt: string | null;
    }
  >();

  for (const message of messages) {
    const current = messageSummaryBySessionId.get(message.widget_session_id) ?? {
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      latestSnippet: null,
      latestCreatedAt: null,
    };

    current.messageCount += 1;
    if (message.role === "user") {
      current.userMessageCount += 1;
    }
    if (message.role === "assistant") {
      current.assistantMessageCount += 1;
    }
    if (
      !current.latestCreatedAt ||
      message.created_at > current.latestCreatedAt
    ) {
      current.latestCreatedAt = message.created_at;
      current.latestSnippet = trimSnippet(message.content);
    }

    messageSummaryBySessionId.set(message.widget_session_id, current);
  }

  const leadSummaryBySessionId = new Map<
    string,
    {
      leadCount: number;
      leadSummary: {
        name: string | null;
        email: string | null;
        phone: string | null;
      } | null;
      latestCreatedAt: string | null;
    }
  >();

  for (const lead of leads) {
    if (!lead.widget_session_id) {
      continue;
    }

    const current = leadSummaryBySessionId.get(lead.widget_session_id) ?? {
      leadCount: 0,
      leadSummary: null,
      latestCreatedAt: null,
    };

    current.leadCount += 1;
    if (!current.latestCreatedAt || lead.created_at > current.latestCreatedAt) {
      current.latestCreatedAt = lead.created_at;
      current.leadSummary = {
        name: lead.name ?? null,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
      };
    }

    leadSummaryBySessionId.set(lead.widget_session_id, current);
  }

  const allRows = candidateSessions
    .map((session) => {
      const widget = widgetById.get(session.widget_id);
      if (!widget) {
        return null;
      }

      const widgetAgent =
        (session.active_widget_agent_id
          ? widgetAgentById.get(session.active_widget_agent_id)
          : null) ??
        (session.active_agent_id
          ? widgetAgentByCompositeKey.get(
              `${session.widget_id}:${session.active_agent_id}`,
            ) ?? null
          : null);
      const agent = session.active_agent_id
        ? agentById.get(session.active_agent_id) ?? null
        : null;
      const messageSummary = messageSummaryBySessionId.get(session.id);
      const leadSummary = leadSummaryBySessionId.get(session.id);

      return {
        widgetSessionId: session.id,
        sessionId: session.session_id,
        widgetId: session.widget_id,
        widgetName: widget.name,
        widgetPublicKey: widget.widget_public_key,
        widgetAgentId: widgetAgent?.id ?? session.active_widget_agent_id ?? null,
        agentId: session.active_agent_id ?? null,
        agentName: agent?.name ?? null,
        agentLabel: agent?.name ?? widgetAgent?.label ?? null,
        source:
          session.source === "hosted" ? "hosted" : "embedded",
        startedAt: session.first_seen_at,
        lastActivityAt: session.last_seen_at,
        messageCount: messageSummary?.messageCount ?? 0,
        userMessageCount: messageSummary?.userMessageCount ?? 0,
        assistantMessageCount: messageSummary?.assistantMessageCount ?? 0,
        latestSnippet: messageSummary?.latestSnippet ?? null,
        pageUrl: session.page_url,
        referrer: session.referrer,
        hasLead: (leadSummary?.leadCount ?? 0) > 0,
        leadCount: leadSummary?.leadCount ?? 0,
        leadSummary: leadSummary?.leadSummary ?? null,
      } satisfies DashboardAnalyticsConversationListItem;
    })
    .filter(Boolean) as DashboardAnalyticsConversationListItem[];

  const filteredRows = allRows
    .filter((row) => matchesSearch(row, input.appliedFilters.search))
    .sort(compareConversationRows);

  const decodedCursor = decodeAnalyticsCursor(input.cursor);
  const rowsAfterCursor = decodedCursor
    ? filteredRows.filter((row) => {
        if (row.lastActivityAt < decodedCursor.lastActivityAt) {
          return true;
        }

        if (row.lastActivityAt > decodedCursor.lastActivityAt) {
          return false;
        }

        return row.widgetSessionId < decodedCursor.widgetSessionId;
      })
    : filteredRows;
  const limit = normalizeLimit(input.limit);
  const conversations = rowsAfterCursor.slice(0, limit);
  const hasMore = rowsAfterCursor.length > limit;
  const lastRow = conversations[conversations.length - 1];

  return {
    widgetOptions,
    agentOptions,
    filteredRows,
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
    transcript: buildTranscriptWithDebugTrace(
      (transcriptData.data ?? []) as AnalyticsTranscriptRow[],
    ),
  }, input.viewerRole);
}
