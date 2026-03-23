import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/runtime/observability";
import type {
  PrivacyDeleteSummary,
  PrivacyExportMessage,
  PrivacyLeadMatch,
  PrivacyRetentionRunSummary,
  PrivacySessionMatch,
  PrivacySubjectExportPayload,
  PrivacySubjectLookupQuery,
  PrivacySubjectLookupResponse,
  PrivacyTranscriptMatch,
  WidgetLeadRecord,
  WidgetSessionMessageRecord,
  WidgetSessionRecord,
  WorkspaceRecord,
} from "@/lib/types";

type AdminSupabase = Pick<SupabaseClient, "from">;

const GDPR_RETENTION_DAYS = 180;

interface PrivacyWidgetRow {
  id: string;
  name: string;
  workspace_id: string;
}

interface PrivacyAgentRow {
  id: string;
  name: string;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function dedupe<T>(items: T[]) {
  return Array.from(new Set(items));
}

function trimSnippet(value: string | null | undefined, maxLength = 160) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function maskEmailForAudit(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visibleLocal = local.length <= 2 ? local[0] ?? "*" : `${local[0]}***${local.at(-1)}`;
  const domainParts = domain.split(".");
  const host = domainParts.shift() ?? "";
  const tld = domainParts.join(".");
  const visibleHost = host.length <= 2 ? `${host[0] ?? "*"}*` : `${host.slice(0, 2)}***`;
  return `${visibleLocal}@${visibleHost}${tld ? `.${tld}` : ""}`;
}

function summarizeQueryForAudit(query: PrivacySubjectLookupQuery) {
  return query.mode === "email"
    ? { mode: "email", email: maskEmailForAudit(query.email ?? "") }
    : { mode: "sessionId", sessionId: query.sessionId ?? "" };
}

function ensureSingleQuery(input: { email?: string | null; sessionId?: string | null }) {
  const email = input.email?.trim() ?? "";
  const sessionId = input.sessionId?.trim() ?? "";

  if (!email && !sessionId) {
    throw new Error("Provide either an email or a session id.");
  }

  if (email && sessionId) {
    throw new Error("Provide either an email or a session id, not both.");
  }

  return email
    ? ({ mode: "email", email } satisfies PrivacySubjectLookupQuery)
    : ({ mode: "sessionId", sessionId } satisfies PrivacySubjectLookupQuery);
}

async function listWorkspaceWidgets(supabase: AdminSupabase, workspaceId: string) {
  const { data, error } = await supabase
    .from("widgets")
    .select("id, name, workspace_id")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  return (data ?? []) as PrivacyWidgetRow[];
}

async function listWorkspaceAgents(supabase: AdminSupabase, workspaceId: string) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  return (data ?? []) as PrivacyAgentRow[];
}

async function fetchLeadsByExactEmail(
  supabase: AdminSupabase,
  widgetIds: string[],
  email: string,
) {
  if (widgetIds.length === 0) return [] as WidgetLeadRecord[];

  const rows: WidgetLeadRecord[] = [];

  for (const widgetIdChunk of chunkArray(widgetIds, 200)) {
    const { data, error } = await supabase
      .from("widget_leads")
      .select("*")
      .in("widget_id", widgetIdChunk)
      .ilike("email", email)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetLeadRecord[]));
  }

  return rows;
}

async function fetchSessionByExactSessionId(
  supabase: AdminSupabase,
  widgetIds: string[],
  sessionId: string,
) {
  if (widgetIds.length === 0) return [] as WidgetSessionRecord[];

  const rows: WidgetSessionRecord[] = [];

  for (const widgetIdChunk of chunkArray(widgetIds, 200)) {
    const { data, error } = await supabase
      .from("widget_sessions")
      .select("*")
      .in("widget_id", widgetIdChunk)
      .eq("session_id", sessionId)
      .order("last_seen_at", { ascending: false });

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetSessionRecord[]));
  }

  return rows;
}

async function fetchSessionsByIds(
  supabase: AdminSupabase,
  widgetSessionIds: string[],
) {
  if (widgetSessionIds.length === 0) return [] as WidgetSessionRecord[];

  const rows: WidgetSessionRecord[] = [];

  for (const idChunk of chunkArray(widgetSessionIds, 200)) {
    const { data, error } = await supabase
      .from("widget_sessions")
      .select("*")
      .in("id", idChunk);

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetSessionRecord[]));
  }

  return rows;
}

async function fetchMessagesBySessionIds(
  supabase: AdminSupabase,
  widgetSessionIds: string[],
) {
  if (widgetSessionIds.length === 0) return [] as WidgetSessionMessageRecord[];

  const rows: WidgetSessionMessageRecord[] = [];

  for (const idChunk of chunkArray(widgetSessionIds, 100)) {
    const { data, error } = await supabase
      .from("widget_session_messages")
      .select("*")
      .in("widget_session_id", idChunk)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetSessionMessageRecord[]));
  }

  return rows;
}

async function fetchTranscriptMessageMatches(
  supabase: AdminSupabase,
  widgetIds: string[],
  email: string,
) {
  if (widgetIds.length === 0) return [] as WidgetSessionMessageRecord[];

  const rows: WidgetSessionMessageRecord[] = [];
  const pattern = `%${email}%`;

  for (const widgetIdChunk of chunkArray(widgetIds, 100)) {
    const { data, error } = await supabase
      .from("widget_session_messages")
      .select("*")
      .in("widget_id", widgetIdChunk)
      .ilike("content", pattern)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetSessionMessageRecord[]));
  }

  return rows;
}

function buildMessageCountMap(messages: WidgetSessionMessageRecord[]) {
  const counts = new Map<string, number>();

  for (const message of messages) {
    counts.set(
      message.widget_session_id,
      (counts.get(message.widget_session_id) ?? 0) + 1,
    );
  }

  return counts;
}

function mapLeadMatch(
  lead: WidgetLeadRecord,
  widgetsById: Map<string, PrivacyWidgetRow>,
  agentsById: Map<string, PrivacyAgentRow>,
  sessionsById: Map<string, WidgetSessionRecord>,
): PrivacyLeadMatch {
  const widget = widgetsById.get(lead.widget_id);
  const session =
    lead.widget_session_id ? sessionsById.get(lead.widget_session_id) ?? null : null;

  return {
    id: lead.id,
    widgetId: lead.widget_id,
    widgetName: widget?.name ?? null,
    widgetSessionId: lead.widget_session_id,
    sessionId: session?.session_id ?? null,
    widgetAgentId: lead.widget_agent_id,
    agentId: lead.agent_id,
    agentName: lead.agent_id ? agentsById.get(lead.agent_id)?.name ?? null : null,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    createdAt: lead.created_at,
  };
}

function mapSessionMatch(
  session: WidgetSessionRecord,
  widgetsById: Map<string, PrivacyWidgetRow>,
  agentsById: Map<string, PrivacyAgentRow>,
  messageCounts: Map<string, number>,
  matchSource: "session_id" | "lead_link",
): PrivacySessionMatch {
  const widget = widgetsById.get(session.widget_id);

  return {
    widgetSessionId: session.id,
    sessionId: session.session_id,
    widgetId: session.widget_id,
    widgetName: widget?.name ?? null,
    widgetAgentId: session.active_widget_agent_id,
    agentId: session.active_agent_id,
    agentName:
      session.active_agent_id
        ? agentsById.get(session.active_agent_id)?.name ?? null
        : null,
    source: session.source,
    startedAt: session.first_seen_at,
    lastActivityAt: session.last_seen_at,
    pageUrl: session.page_url,
    referrer: session.referrer,
    messageCount: messageCounts.get(session.id) ?? 0,
    matchSource,
  };
}

function mapTranscriptMatch(
  session: WidgetSessionRecord,
  widgetsById: Map<string, PrivacyWidgetRow>,
  agentsById: Map<string, PrivacyAgentRow>,
  messageCounts: Map<string, number>,
  matchedSnippet: string | null,
): PrivacyTranscriptMatch {
  const widget = widgetsById.get(session.widget_id);

  return {
    widgetSessionId: session.id,
    sessionId: session.session_id,
    widgetId: session.widget_id,
    widgetName: widget?.name ?? null,
    widgetAgentId: session.active_widget_agent_id,
    agentId: session.active_agent_id,
    agentName:
      session.active_agent_id
        ? agentsById.get(session.active_agent_id)?.name ?? null
        : null,
    source: session.source,
    startedAt: session.first_seen_at,
    lastActivityAt: session.last_seen_at,
    pageUrl: session.page_url,
    referrer: session.referrer,
    messageCount: messageCounts.get(session.id) ?? 0,
    matchedSnippet,
  };
}

export async function lookupWorkspaceSubjectData(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    email?: string | null;
    sessionId?: string | null;
  },
): Promise<PrivacySubjectLookupResponse> {
  const query = ensureSingleQuery(input);
  const widgets = await listWorkspaceWidgets(supabase, input.workspaceId);
  const agents = await listWorkspaceAgents(supabase, input.workspaceId);
  const widgetIds = widgets.map((widget) => widget.id);
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  if (widgetIds.length === 0) {
    return {
      query,
      summary: {
        leadCount: 0,
        sessionCount: 0,
        messageCount: 0,
        transcriptMatchSessionCount: 0,
      },
      leadMatches: [],
      sessionMatches: [],
      transcriptMatches: [],
    };
  }

  let leads: WidgetLeadRecord[] = [];
  let directSessions: WidgetSessionRecord[] = [];
  let transcriptMatches: WidgetTranscriptMatchRecord[] = [];

  if (query.mode === "email") {
    leads = await fetchLeadsByExactEmail(supabase, widgetIds, query.email ?? "");
    transcriptMatches = await fetchTranscriptMessageMatches(
      supabase,
      widgetIds,
      query.email ?? "",
    );
  } else {
    directSessions = await fetchSessionByExactSessionId(
      supabase,
      widgetIds,
      query.sessionId ?? "",
    );
    leads = await fetchLeadsBySessionIds(
      supabase,
      directSessions.map((session) => session.id),
    );
  }

  const leadLinkedSessionIds = dedupe(
    leads.map((lead) => lead.widget_session_id).filter(Boolean) as string[],
  );
  const leadLinkedSessions = await fetchSessionsByIds(supabase, leadLinkedSessionIds);

  const directSessionMap = new Map<string, WidgetSessionRecord>();
  for (const session of [...directSessions, ...leadLinkedSessions]) {
    directSessionMap.set(session.id, session);
  }

  const transcriptSessionIds = dedupe(
    transcriptMatches.map((message) => message.widget_session_id),
  ).filter((sessionId) => !directSessionMap.has(sessionId));
  const transcriptSessions = await fetchSessionsByIds(supabase, transcriptSessionIds);

  const allMatchedSessionIds = dedupe([
    ...Array.from(directSessionMap.keys()),
    ...transcriptSessionIds,
  ]);
  const allMessages = await fetchMessagesBySessionIds(supabase, allMatchedSessionIds);
  const messageCounts = buildMessageCountMap(allMessages);

  const sessionsById = new Map<string, WidgetSessionRecord>([
    ...Array.from(directSessionMap.entries()),
    ...transcriptSessions.map((session) => [session.id, session] as const),
  ]);

  const leadMatches = leads.map((lead) =>
    mapLeadMatch(lead, widgetsById, agentsById, sessionsById),
  );

  const sessionMatches: PrivacySessionMatch[] = [];
  for (const session of directSessions) {
    sessionMatches.push(
      mapSessionMatch(session, widgetsById, agentsById, messageCounts, "session_id"),
    );
  }
  for (const session of leadLinkedSessions) {
    if (directSessions.some((item) => item.id === session.id)) continue;
    sessionMatches.push(
      mapSessionMatch(session, widgetsById, agentsById, messageCounts, "lead_link"),
    );
  }

  const transcriptMessageBySessionId = new Map<string, WidgetSessionMessageRecord>();
  for (const message of transcriptMatches) {
    if (!transcriptMessageBySessionId.has(message.widget_session_id)) {
      transcriptMessageBySessionId.set(message.widget_session_id, message);
    }
  }

  const transcriptSessionMatches = transcriptSessions.map((session) =>
    mapTranscriptMatch(
      session,
      widgetsById,
      agentsById,
      messageCounts,
      trimSnippet(transcriptMessageBySessionId.get(session.id)?.content),
    ),
  );

  return {
    query,
    summary: {
      leadCount: leadMatches.length,
      sessionCount: sessionMatches.length,
      messageCount: allMessages.length,
      transcriptMatchSessionCount: transcriptSessionMatches.length,
    },
    leadMatches,
    sessionMatches,
    transcriptMatches: transcriptSessionMatches,
  };
}

type WidgetTranscriptMatchRecord = WidgetSessionMessageRecord;

export async function buildWorkspaceSubjectExport(
  supabase: AdminSupabase,
  input: {
    workspace: WorkspaceRecord;
    email?: string | null;
    sessionId?: string | null;
  },
): Promise<PrivacySubjectExportPayload> {
  const lookup = await lookupWorkspaceSubjectData(supabase, {
    workspaceId: input.workspace.id,
    email: input.email,
    sessionId: input.sessionId,
  });

  const sessionIds = dedupe([
    ...lookup.sessionMatches.map((item) => item.widgetSessionId),
    ...lookup.transcriptMatches.map((item) => item.widgetSessionId),
  ]);
  const messages = await fetchMessagesBySessionIds(supabase, sessionIds);

  const exportMessages: PrivacyExportMessage[] = messages.map((message) => ({
    id: message.id,
    widgetSessionId: message.widget_session_id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.created_at,
  }));

  return {
    workspace: {
      id: input.workspace.id,
      name: input.workspace.name,
      slug: input.workspace.slug,
    },
    query: lookup.query,
    exportedAt: new Date().toISOString(),
    summary: lookup.summary,
    leadMatches: lookup.leadMatches,
    sessionMatches: lookup.sessionMatches,
    transcriptMatches: lookup.transcriptMatches,
    messages: exportMessages,
  };
}

export async function deleteWorkspaceSubjectData(
  supabase: AdminSupabase,
  input: {
    workspaceId: string;
    email?: string | null;
    sessionId?: string | null;
    includeTranscriptMatches?: boolean;
  },
): Promise<PrivacyDeleteSummary> {
  const lookup = await lookupWorkspaceSubjectData(supabase, {
    workspaceId: input.workspaceId,
    email: input.email,
    sessionId: input.sessionId,
  });

  const leadIdsToDelete = new Set<string>(lookup.leadMatches.map((lead) => lead.id));
  const sessionIdsToDelete = new Set<string>();

  if (lookup.query.mode === "sessionId") {
    for (const match of lookup.sessionMatches) {
      sessionIdsToDelete.add(match.widgetSessionId);
    }
  }

  if (input.includeTranscriptMatches) {
    for (const match of lookup.transcriptMatches) {
      sessionIdsToDelete.add(match.widgetSessionId);
    }
  }

  if (sessionIdsToDelete.size > 0) {
    for (const lead of lookup.leadMatches) {
      if (lead.widgetSessionId && sessionIdsToDelete.has(lead.widgetSessionId)) {
        leadIdsToDelete.add(lead.id);
      }
    }

    const linkedLeads = await fetchLeadsBySessionIds(
      supabase,
      Array.from(sessionIdsToDelete),
    );
    for (const lead of linkedLeads) {
      leadIdsToDelete.add(lead.id);
    }
  }

  const sessionIds = Array.from(sessionIdsToDelete);
  const messageCount =
    sessionIds.length > 0
      ? (await fetchMessagesBySessionIds(supabase, sessionIds)).length
      : 0;

  if (leadIdsToDelete.size > 0) {
    for (const idChunk of chunkArray(Array.from(leadIdsToDelete), 200)) {
      const { error } = await supabase.from("widget_leads").delete().in("id", idChunk);
      if (error) throw new Error(error.message);
    }
  }

  if (sessionIds.length > 0) {
    for (const idChunk of chunkArray(sessionIds, 100)) {
      const { error } = await supabase.from("widget_sessions").delete().in("id", idChunk);
      if (error) throw new Error(error.message);
    }
  }

  return {
    leadCount: leadIdsToDelete.size,
    sessionCount: sessionIds.length,
    messageCount,
  };
}

async function fetchLeadsBySessionIds(
  supabase: AdminSupabase,
  widgetSessionIds: string[],
) {
  if (widgetSessionIds.length === 0) return [] as WidgetLeadRecord[];

  const rows: WidgetLeadRecord[] = [];

  for (const idChunk of chunkArray(widgetSessionIds, 200)) {
    const { data, error } = await supabase
      .from("widget_leads")
      .select("*")
      .in("widget_session_id", idChunk);

    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as WidgetLeadRecord[]));
  }

  return rows;
}

export async function purgeExpiredWidgetData(
  supabase: AdminSupabase,
  input?: { dryRun?: boolean; now?: Date },
): Promise<PrivacyRetentionRunSummary> {
  const now = input?.now ?? new Date();
  const cutoff = new Date(now.getTime() - GDPR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const { data: expiredLeadRows, error: expiredLeadError } = await supabase
    .from("widget_leads")
    .select("id, widget_id, created_at")
    .lt("created_at", cutoffIso);

  if (expiredLeadError) throw new Error(expiredLeadError.message);

  const { data: expiredSessionRows, error: expiredSessionError } = await supabase
    .from("widget_sessions")
    .select("id, widget_id, last_seen_at")
    .lt("last_seen_at", cutoffIso);

  if (expiredSessionError) throw new Error(expiredSessionError.message);

  const expiredLeadIds = ((expiredLeadRows ?? []) as Array<{ id: string; widget_id: string }>).map(
    (row) => row.id,
  );
  const expiredSessionIds = ((expiredSessionRows ?? []) as Array<{ id: string; widget_id: string }>).map(
    (row) => row.id,
  );

  const messageCount =
    expiredSessionIds.length > 0
      ? (await fetchMessagesBySessionIds(supabase, expiredSessionIds)).length
      : 0;

  if (!input?.dryRun) {
    if (expiredLeadIds.length > 0) {
      for (const idChunk of chunkArray(expiredLeadIds, 200)) {
        const { error } = await supabase.from("widget_leads").delete().in("id", idChunk);
        if (error) throw new Error(error.message);
      }
    }

    if (expiredSessionIds.length > 0) {
      for (const idChunk of chunkArray(expiredSessionIds, 100)) {
        const { error } = await supabase.from("widget_sessions").delete().in("id", idChunk);
        if (error) throw new Error(error.message);
      }
    }

    const widgetIds = dedupe([
      ...((expiredLeadRows ?? []) as Array<{ widget_id: string }>).map((row) => row.widget_id),
      ...((expiredSessionRows ?? []) as Array<{ widget_id: string }>).map((row) => row.widget_id),
    ]);

    if (widgetIds.length > 0) {
      const widgets = await listWidgetsByIds(supabase, widgetIds);
      const countsByWorkspace = new Map<
        string,
        { leadCount: number; sessionCount: number; messageCount: number }
      >();

      for (const row of (expiredLeadRows ?? []) as Array<{ widget_id: string }>) {
        const workspaceId = widgets.get(row.widget_id)?.workspace_id;
        if (!workspaceId) continue;
        const current = countsByWorkspace.get(workspaceId) ?? {
          leadCount: 0,
          sessionCount: 0,
          messageCount: 0,
        };
        current.leadCount += 1;
        countsByWorkspace.set(workspaceId, current);
      }

      if (expiredSessionIds.length > 0) {
        const messagesByWidgetId = await fetchMessageCountsByWidgetSessionIds(
          supabase,
          expiredSessionIds,
        );

        for (const row of (expiredSessionRows ?? []) as Array<{ id: string; widget_id: string }>) {
          const workspaceId = widgets.get(row.widget_id)?.workspace_id;
          if (!workspaceId) continue;
          const current = countsByWorkspace.get(workspaceId) ?? {
            leadCount: 0,
            sessionCount: 0,
            messageCount: 0,
          };
          current.sessionCount += 1;
          current.messageCount += messagesByWidgetId.get(row.id) ?? 0;
          countsByWorkspace.set(workspaceId, current);
        }
      }

      for (const [workspaceId, counts] of countsByWorkspace.entries()) {
        await createAuditLog(supabase as never, {
          workspaceId,
          action: "privacy.retention.run",
          summary: "Purged expired widget data under the 180-day retention policy.",
          metadata: {
            cutoffIso,
            ...counts,
          },
        });
      }
    }
  }

  return {
    cutoffIso,
    dryRun: Boolean(input?.dryRun),
    deleted: {
      leadCount: expiredLeadIds.length,
      sessionCount: expiredSessionIds.length,
      messageCount,
    },
  };
}

async function listWidgetsByIds(supabase: AdminSupabase, widgetIds: string[]) {
  const widgets = new Map<string, PrivacyWidgetRow>();

  for (const idChunk of chunkArray(widgetIds, 200)) {
    const { data, error } = await supabase
      .from("widgets")
      .select("id, name, workspace_id")
      .in("id", idChunk);

    if (error) throw new Error(error.message);
    for (const widget of (data ?? []) as PrivacyWidgetRow[]) {
      widgets.set(widget.id, widget);
    }
  }

  return widgets;
}

async function fetchMessageCountsByWidgetSessionIds(
  supabase: AdminSupabase,
  widgetSessionIds: string[],
) {
  const messages = await fetchMessagesBySessionIds(supabase, widgetSessionIds);
  return buildMessageCountMap(messages);
}

export function getGdprRetentionDays() {
  return GDPR_RETENTION_DAYS;
}

export function summarizePrivacyLookupForAudit(
  lookup: PrivacySubjectLookupResponse,
) {
  return {
    ...summarizeQueryForAudit(lookup.query),
    summary: lookup.summary,
  };
}
