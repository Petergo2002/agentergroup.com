import type { SupabaseClient } from "@supabase/supabase-js";
import { readAutomationRunResult } from "@/lib/automation/result";
import { buildConversationDetailForViewer } from "@/lib/debug-trace-security";
import {
  serializeLeadConversationSummary,
  type LeadConversationSummaryRow,
} from "@/lib/leads/conversation-summary";
import type {
  AutomationEventStatus,
  AutomationDecision,
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAutomationAgentSummary,
  DashboardAutomationAnalytics,
  DashboardAutomationFailureSummary,
  DashboardAutomationTrendPoint,
  DashboardAnalyticsOverview,
  DashboardAnalyticsRange,
  DashboardConversationDetailResponse,
  DashboardLatestActivityResponse,
  DebugEvent,
  DebugTrace,
  WorkspaceMemberRecord,
} from "@/lib/types";

type AdminSupabase = Pick<SupabaseClient, "from" | "storage">;

interface AnalyticsWidgetRow {
  id: string;
  name: string;
  status: "draft" | "deployed";
  widget_public_key: string;
}

interface AnalyticsAgentRow {
  id: string;
  name: string;
  surface: string;
  status?: string;
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

interface AnalyticsAutomationEventRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  automation_id: string;
  run_id: string | null;
  external_event_id: string;
  trigger_slug: string;
  status: AutomationEventStatus;
  created_at: string;
  updated_at: string;
}

interface AnalyticsAutomationRunRow {
  id: string;
  agent_id: string;
  status: string;
  output?: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface AutomationRunInspection {
  decision: AutomationDecision | null;
  summary: string | null;
  failed: boolean;
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
  agentOptions: Array<{ id: string; name: string; surface: string }>;
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
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

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

async function refreshTranscriptAttachmentUrls(
  supabase: AdminSupabase,
  widgetSessionId: string,
  messages: AnalyticsTranscriptRow[],
) {
  const attachmentIds = Array.from(
    new Set(
      messages.flatMap((message) => {
        const attachments = message.metadata?.attachments;
        if (!Array.isArray(attachments)) return [];

        return attachments.flatMap((attachment) => {
          if (
            !attachment ||
            typeof attachment !== "object" ||
            !("id" in attachment) ||
            typeof attachment.id !== "string"
          ) {
            return [];
          }

          return [attachment.id];
        });
      }),
    ),
  );

  if (attachmentIds.length === 0) {
    return messages;
  }

  const { data, error } = await supabase
    .from("widget_attachments")
    .select(
      "id, storage_bucket, storage_path, original_name, mime_type, file_size_bytes",
    )
    .eq("widget_session_id", widgetSessionId)
    .in("id", attachmentIds);

  if (error) {
    throw new Error(error.message);
  }

  const signedAttachments = await Promise.all(
    ((data ?? []) as Array<{
      id: string;
      storage_bucket: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      file_size_bytes: number;
    }>).map(async (attachment) => {
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from(attachment.storage_bucket)
          .createSignedUrl(
            attachment.storage_path,
            ATTACHMENT_SIGNED_URL_TTL_SECONDS,
          );

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return null;
      }

      return {
        id: attachment.id,
        url: signedUrlData.signedUrl,
        name: attachment.original_name,
        type: attachment.mime_type,
        size: attachment.file_size_bytes,
      };
    }),
  );
  const attachmentById = new Map(
    signedAttachments
      .filter((attachment) => attachment !== null)
      .map((attachment) => [attachment.id, attachment]),
  );

  return messages.map((message) => {
    const attachments = message.metadata?.attachments;
    if (!Array.isArray(attachments)) return message;

    const refreshed = attachments.flatMap((attachment) => {
      if (
        !attachment ||
        typeof attachment !== "object" ||
        !("id" in attachment) ||
        typeof attachment.id !== "string"
      ) {
        return [attachment];
      }

      const signedAttachment = attachmentById.get(attachment.id);
      return signedAttachment ? [signedAttachment] : [];
    });

    return {
      ...message,
      metadata: {
        ...message.metadata,
        attachments: refreshed,
      },
    };
  });
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
    .select("id, name, surface")
    .eq("workspace_id", workspaceId)
    .in("surface", ["widget", "automation"])
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

function formatAutomationTriggerLabel(triggerSlug: string) {
  if (triggerSlug === "GMAIL_NEW_GMAIL_MESSAGE") return "Gmail new message";
  return triggerSlug
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function inspectAutomationRun(run: AnalyticsAutomationRunRow | null): AutomationRunInspection {
  if (!run) {
    return {
      decision: null,
      summary: null,
      failed: false,
    };
  }

  const result = readAutomationRunResult(run.output?.automationResult);
  const failed = Boolean(
    run.status === "failed" ||
      run.error_message ||
      result?.decision === "action_failed",
  );

  return {
    decision: result?.decision ?? (failed ? "action_failed" : null),
    summary: result?.summary ?? run.error_message ?? null,
    failed,
  };
}

async function fetchAutomationEventsForAnalytics(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    agentId: string | null;
    automationStatus: DashboardAnalyticsAppliedFilters["automationStatus"];
  },
) {
  const pageSize = 1000;
  const rows: AnalyticsAutomationEventRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("automation_events")
      .select("id, workspace_id, agent_id, automation_id, run_id, external_event_id, trigger_slug, status, created_at, updated_at")
      .eq("workspace_id", input.workspaceId)
      .gte("created_at", input.startIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (input.agentId) {
      query = query.eq("agent_id", input.agentId);
    }

    if (input.automationStatus !== "all") {
      query = query.eq("status", input.automationStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as AnalyticsAutomationEventRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return rows;
}

export async function getDashboardAutomationAnalytics(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    startIso: string;
    agentId: string | null;
    automationStatus: DashboardAnalyticsAppliedFilters["automationStatus"];
  },
): Promise<DashboardAutomationAnalytics> {
  const events = await fetchAutomationEventsForAnalytics(supabase, input);
  const runIds = Array.from(
    new Set(events.map((event) => event.run_id).filter((id): id is string => Boolean(id))),
  );
  const agentIds = Array.from(new Set(events.map((event) => event.agent_id)));

  const [runsResult, agentsResult] = await Promise.all([
    runIds.length > 0
      ? supabase
          .from("runs")
          .select("id, agent_id, status, output, error_message, created_at, completed_at")
          .in("id", runIds)
      : Promise.resolve({ data: [], error: null }),
    agentIds.length > 0
      ? supabase
          .from("agents")
          .select("id, name, surface, status")
          .eq("workspace_id", input.workspaceId)
          .in("id", agentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (runsResult.error) {
    throw new Error(runsResult.error.message);
  }

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message);
  }

  const runsById = new Map(
    ((runsResult.data ?? []) as AnalyticsAutomationRunRow[]).map((run) => [run.id, run]),
  );
  const agentsById = new Map(
    ((agentsResult.data ?? []) as AnalyticsAgentRow[]).map((agent) => [agent.id, agent]),
  );
  const agentSummaries = new Map<string, DashboardAutomationAgentSummary>();
  const totals = {
    totalEvents: events.length,
    processedEvents: 0,
    failedEvents: 0,
    actionTaken: 0,
    noAction: 0,
    needsInput: 0,
    actionFailed: 0,
  };

  const trendByDate = new Map<string, DashboardAutomationTrendPoint>();
  const recentFailures: DashboardAutomationFailureSummary[] = [];

  for (const event of events) {
    const run = event.run_id ? runsById.get(event.run_id) ?? null : null;
    const runInspection = inspectAutomationRun(run);
    const decision = runInspection.decision;
    const agent = agentsById.get(event.agent_id);
    const agentName = agent?.name ?? "Automation";
    const summary = agentSummaries.get(event.agent_id) ?? {
      agentId: event.agent_id,
      agentName,
      status: agent?.status ?? "unknown",
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      actionTaken: 0,
      noAction: 0,
      needsInput: 0,
      actionFailed: 0,
      lastEventAt: null,
      activityHref: `/agents/${event.agent_id}/activity`,
    };

    summary.totalEvents += 1;
    summary.lastEventAt =
      !summary.lastEventAt || event.created_at > summary.lastEventAt
        ? event.created_at
        : summary.lastEventAt;

    if (event.status === "processed") {
      totals.processedEvents += 1;
      summary.processedEvents += 1;
    }

    const failed = event.status === "failed" || runInspection.failed;
    const trendDate = event.created_at.slice(0, 10);
    const trendPoint = trendByDate.get(trendDate) ?? {
      date: trendDate,
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
    };

    trendPoint.totalEvents += 1;
    if (event.status === "processed") {
      trendPoint.processedEvents += 1;
    }
    if (failed) {
      trendPoint.failedEvents += 1;
    }
    trendByDate.set(trendDate, trendPoint);

    if (failed) {
      totals.failedEvents += 1;
      summary.failedEvents += 1;
    }

    if (decision === "action_taken") {
      totals.actionTaken += 1;
      summary.actionTaken += 1;
    } else if (decision === "no_action") {
      totals.noAction += 1;
      summary.noAction += 1;
    } else if (decision === "needs_input") {
      totals.needsInput += 1;
      summary.needsInput += 1;
    } else if (decision === "action_failed") {
      totals.actionFailed += 1;
      summary.actionFailed += 1;
    }

    if (failed && recentFailures.length < 8) {
      recentFailures.push({
        eventId: event.id,
        runId: event.run_id,
        agentId: event.agent_id,
        agentName,
        triggerLabel: formatAutomationTriggerLabel(event.trigger_slug),
        eventStatus: event.status,
        runStatus: run?.status ?? null,
        decision,
        summary: runInspection.summary,
        errorMessage: run?.error_message ?? null,
        createdAt: event.created_at,
        activityHref: `/agents/${event.agent_id}/activity?event=${event.id}`,
      });
    }

    agentSummaries.set(event.agent_id, summary);
  }

  const successRate = totals.totalEvents > 0
    ? Math.round((totals.processedEvents / totals.totalEvents) * 100)
    : 0;

  return {
    ...totals,
    successRate,
    trend: Array.from(trendByDate.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    agents: Array.from(agentSummaries.values()).sort((left, right) => {
      if (left.lastEventAt !== right.lastEventAt) {
        return (right.lastEventAt ?? "").localeCompare(left.lastEventAt ?? "");
      }
      return left.agentName.localeCompare(right.agentName);
    }),
    recentFailures,
  };
}

/**
 * Counts leads captured during the last 24 hours for one workspace.
 */
async function countRecentWorkspaceLeads(
  supabase: AdminSupabase,
  workspaceId: string,
) {
  const widgetsResult = await supabase
    .from("widgets")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (widgetsResult.error) {
    throw new Error(widgetsResult.error.message);
  }

  const widgetIds = (widgetsResult.data ?? []).map((widget) => widget.id as string);

  if (widgetIds.length === 0) {
    return 0;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const leadsResult = await supabase
    .from("widget_leads")
    .select("id", { count: "exact", head: true })
    .in("widget_id", widgetIds)
    .gte("created_at", since);

  if (leadsResult.error) {
    throw new Error(leadsResult.error.message);
  }

  return leadsResult.count ?? 0;
}

/**
 * Returns the newest conversation summary and recent lead count for sidebar attention states.
 */
export async function getDashboardLatestActivity(
  supabase: AdminSupabase,
  workspaceId: string,
): Promise<DashboardLatestActivityResponse> {
  const [recentConversations, newLeadCount] = await Promise.all([
    listRecentDashboardConversations(supabase, {
      workspaceId,
      range: "30d",
      limit: 1,
    }),
    countRecentWorkspaceLeads(supabase, workspaceId),
  ]);
  const [latest] = recentConversations;

  if (!latest) {
    return { latestConversation: null, newLeadCount };
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
    newLeadCount,
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
    surface: agent.surface,
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

  const summaryResult = leadData.data
    ? await supabase
        .from("lead_conversation_summaries")
        .select(
          "lead_id, workspace_id, widget_session_id, status, summary, model, source_hash, source_message_count, source_last_message_at, generated_at, error_message, updated_at",
        )
        .eq("lead_id", leadData.data.id)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle()
    : { data: null, error: null };

  if (summaryResult.error) {
    throw new Error(summaryResult.error.message);
  }

  const widgetAgent =
    (session.active_widget_agent_id
      ? widgetAgents.find((item) => item.id === session.active_widget_agent_id) ?? null
      : null) ??
    (session.active_agent_id
      ? widgetAgents.find((item) => item.agent_id === session.active_agent_id) ?? null
      : null);

  const agent = (agentResult.data ?? null) as AnalyticsAgentRow | null;
  const transcriptRows = await refreshTranscriptAttachmentUrls(
    supabase,
    session.id,
    (transcriptData.data ?? []) as AnalyticsTranscriptRow[],
  );
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
  const currentMessageCount = transcriptRows.filter(
    (message) => message.role === "user" || message.role === "assistant",
  ).length;
  const summaryRow = (summaryResult.data ?? null) as LeadConversationSummaryRow | null;
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
    aiSummary: summaryRow
      ? serializeLeadConversationSummary(summaryRow, currentMessageCount)
      : null,
    transcript: buildTranscriptWithDebugTrace(
      transcriptRows,
    ),
  }, input.viewerRole);
}
