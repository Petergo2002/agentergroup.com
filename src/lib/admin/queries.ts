import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdminDailyMessageActivityPoint,
  AdminOverviewData,
  AdminWorkspaceDetailData,
  AdminWorkspaceWidgetRow,
} from "@/lib/admin/types";

type WorkspaceRow = { id: string; name: string; owner_id: string; created_at: string };
type ProfileRow = { id: string; email: string | null };
type AgentRow = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
};
type ThreadRow = { id: string; workspace_id: string; agent_id: string };
type MessageRow = { thread_id: string; workspace_id: string; created_at: string };
type WidgetRow = {
  id: string;
  workspace_id: string;
  name: string;
  widget_public_key: string;
  created_at: string;
  status: string;
};
type WidgetSessionRow = {
  id: string;
  widget_id: string;
  active_agent_id: string | null;
  source: string;
  last_seen_at: string;
};
type WidgetMessageRow = {
  widget_session_id: string;
  widget_id: string;
  agent_id: string | null;
  created_at: string;
};
type WidgetLeadRow = {
  widget_id: string;
  created_at: string;
};

const LIVE_WIDGET_SOURCES = new Set(["embedded", "hosted"]);

function throwOnError(error: { message?: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function incrementCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function addConversationId(map: Map<string, Set<string>>, key: string, conversationId: string) {
  const current = map.get(key) ?? new Set<string>();
  current.add(conversationId);
  map.set(key, current);
}

function pickLatest(previous: string | null | undefined, candidate: string | null | undefined) {
  if (!candidate) return previous ?? null;
  if (!previous || candidate > previous) return candidate;
  return previous;
}

function buildDayWindow(days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - index - 1));
    return {
      dateKey: date.toISOString().slice(0, 10),
      label: formatter.format(date),
    };
  });
}

function truncateWidgetPublicKey(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

/**
 * Returns top-level admin counts and per-workspace usage/build activity.
 */
export async function getAdminOverview(): Promise<AdminOverviewData> {
  const admin = createAdminClient();
  const last30DaysIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [workspacesResult, profilesResult, agentsResult, threadsResult, messagesResult, widgetsResult, sessionsResult, widgetMessagesResult] =
    await Promise.all([
      admin.from("workspaces").select("id, name, owner_id, created_at").order("created_at", { ascending: false }),
      admin.from("profiles").select("id, email"),
      admin.from("agents").select("id, workspace_id, name, created_at, archived_at"),
      admin.from("chat_threads").select("id, workspace_id, agent_id"),
      admin.from("messages").select("thread_id, workspace_id, created_at"),
      admin.from("widgets").select("id, workspace_id"),
      admin.from("widget_sessions").select("id, widget_id, active_agent_id, source"),
      admin.from("widget_session_messages").select("widget_session_id, agent_id, created_at"),
    ]);

  throwOnError(workspacesResult.error, "Failed to load workspaces.");
  throwOnError(profilesResult.error, "Failed to load profiles.");
  throwOnError(agentsResult.error, "Failed to load agents.");
  throwOnError(threadsResult.error, "Failed to load conversations.");
  throwOnError(messagesResult.error, "Failed to load messages.");
  throwOnError(widgetsResult.error, "Failed to load widgets.");
  throwOnError(sessionsResult.error, "Failed to load widget sessions.");
  throwOnError(widgetMessagesResult.error, "Failed to load widget messages.");

  const workspaces = (workspacesResult.data ?? []) as WorkspaceRow[];
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const agents = ((agentsResult.data ?? []) as AgentRow[]).filter((agent) => !agent.archived_at);
  const messages = (messagesResult.data ?? []) as MessageRow[];
  const widgets = (widgetsResult.data ?? []) as WidgetRow[];
  const liveWidgetSessions = ((sessionsResult.data ?? []) as WidgetSessionRow[]).filter((session) =>
    LIVE_WIDGET_SOURCES.has(session.source),
  );
  const liveWidgetSessionIds = new Set(liveWidgetSessions.map((session) => session.id));
  const widgetMessages = ((widgetMessagesResult.data ?? []) as WidgetMessageRow[]).filter((message) =>
    liveWidgetSessionIds.has(message.widget_session_id),
  );

  const ownerEmailById = new Map(profiles.map((profile) => [profile.id, profile.email] as const));
  const agentCountByWorkspace = new Map<string, number>();
  const widgetCountByWorkspace = new Map<string, number>();
  const conversations30dByWorkspace = new Map<string, Set<string>>();
  const messageCount30dByWorkspace = new Map<string, number>();
  const lastActiveByWorkspace = new Map<string, string>();
  const widgetWorkspaceBySessionId = new Map<string, string>();
  const widgetWorkspaceById = new Map(widgets.map((widget) => [widget.id, widget.workspace_id] as const));

  for (const agent of agents) {
    incrementCount(agentCountByWorkspace, agent.workspace_id);
  }

  for (const widget of widgets) {
    incrementCount(widgetCountByWorkspace, widget.workspace_id);
  }

  for (const session of liveWidgetSessions) {
    const workspaceId = widgetWorkspaceById.get(session.widget_id);
    if (workspaceId) {
      widgetWorkspaceBySessionId.set(session.id, workspaceId);
    }
  }

  for (const message of messages) {
    if (message.created_at >= last30DaysIso) {
      addConversationId(
        conversations30dByWorkspace,
        message.workspace_id,
        `thread:${message.thread_id}`,
      );
      incrementCount(messageCount30dByWorkspace, message.workspace_id);
    }

    lastActiveByWorkspace.set(
      message.workspace_id,
      pickLatest(lastActiveByWorkspace.get(message.workspace_id), message.created_at) as string,
    );
  }

  for (const message of widgetMessages) {
    const workspaceId = widgetWorkspaceBySessionId.get(message.widget_session_id);
    if (!workspaceId) continue;

    if (message.created_at >= last30DaysIso) {
      addConversationId(
        conversations30dByWorkspace,
        workspaceId,
        `widget:${message.widget_session_id}`,
      );
      incrementCount(messageCount30dByWorkspace, workspaceId);
    }

    lastActiveByWorkspace.set(
      workspaceId,
      pickLatest(lastActiveByWorkspace.get(workspaceId), message.created_at) as string,
    );
  }

  return {
    summary: {
      totalWorkspaces: workspaces.length,
      totalAgents: agents.length,
      totalConversations: ((threadsResult.data ?? []) as ThreadRow[]).length + liveWidgetSessions.length,
      totalMessages: messages.length + widgetMessages.length,
    },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      ownerEmail: ownerEmailById.get(workspace.owner_id) ?? null,
      createdAt: workspace.created_at,
      agentCount: agentCountByWorkspace.get(workspace.id) ?? 0,
      widgetCount: widgetCountByWorkspace.get(workspace.id) ?? 0,
      conversationCount30d: conversations30dByWorkspace.get(workspace.id)?.size ?? 0,
      messageCount30d: messageCount30dByWorkspace.get(workspace.id) ?? 0,
      lastActiveAt: lastActiveByWorkspace.get(workspace.id) ?? null,
    })),
  };
}

/**
 * Returns one workspace and per-agent usage totals for the internal admin view.
 */
export async function getWorkspaceDetail(
  workspaceId: string,
): Promise<AdminWorkspaceDetailData | null> {
  const admin = createAdminClient();
  const workspaceResult = await admin
    .from("workspaces")
    .select("id, name, owner_id, created_at")
    .eq("id", workspaceId)
    .maybeSingle();

  throwOnError(workspaceResult.error, "Failed to load workspace.");
  if (!workspaceResult.data) return null;

  const workspace = workspaceResult.data as WorkspaceRow;
  const [ownerResult, agentsResult, threadsResult, messagesResult, widgetsResult] =
    await Promise.all([
      admin.from("profiles").select("email").eq("id", workspace.owner_id).maybeSingle(),
      admin.from("agents").select("id, workspace_id, name, created_at, archived_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      admin.from("chat_threads").select("id, workspace_id, agent_id").eq("workspace_id", workspaceId),
      admin.from("messages").select("thread_id, workspace_id, created_at").eq("workspace_id", workspaceId),
      admin.from("widgets").select("id, workspace_id, name, widget_public_key, created_at, status").eq("workspace_id", workspaceId),
    ]);

  throwOnError(ownerResult.error, "Failed to load workspace owner.");
  throwOnError(agentsResult.error, "Failed to load agents.");
  throwOnError(threadsResult.error, "Failed to load workspace conversations.");
  throwOnError(messagesResult.error, "Failed to load workspace messages.");
  throwOnError(widgetsResult.error, "Failed to load workspace widgets.");

  const agents = ((agentsResult.data ?? []) as AgentRow[]).filter((agent) => !agent.archived_at);
  const threadAgentById = new Map(
    (((threadsResult.data ?? []) as ThreadRow[]).map((thread) => [thread.id, thread.agent_id] as const)),
  );
  const widgetIds = new Set(((widgetsResult.data ?? []) as WidgetRow[]).map((widget) => widget.id));
  const liveSessionAgentById = new Map<string, string>();
  const liveSessionIds = new Set<string>();
  const conversationIdsByAgent = new Map<string, Set<string>>();
  const messageCountByAgent = new Map<string, number>();
  const lastActiveByAgent = new Map<string, string>();
  let totalConversationCount = ((threadsResult.data ?? []) as ThreadRow[]).length;
  let totalMessageCount = ((messagesResult.data ?? []) as MessageRow[]).length;
  let workspaceLastActiveAt =
    ((messagesResult.data ?? []) as MessageRow[]).reduce<string | null>(
      (latest, message) => pickLatest(latest, message.created_at),
      null,
    ) ?? null;

  for (const thread of (threadsResult.data ?? []) as ThreadRow[]) {
    addConversationId(conversationIdsByAgent, thread.agent_id, `thread:${thread.id}`);
  }

  for (const message of (messagesResult.data ?? []) as MessageRow[]) {
    const agentId = threadAgentById.get(message.thread_id);
    if (!agentId) continue;

    incrementCount(messageCountByAgent, agentId);
    lastActiveByAgent.set(
      agentId,
      pickLatest(lastActiveByAgent.get(agentId), message.created_at) as string,
    );
  }

  if (widgetIds.size > 0) {
    const widgetIdList = [...widgetIds];
    const [sessionsResult, widgetMessagesResult] = await Promise.all([
      admin
        .from("widget_sessions")
        .select("id, widget_id, active_agent_id, source, last_seen_at")
        .in("widget_id", widgetIdList),
      admin
        .from("widget_session_messages")
        .select("widget_session_id, widget_id, agent_id, created_at")
        .in("widget_id", widgetIdList),
    ]);

    throwOnError(sessionsResult.error, "Failed to load widget sessions.");
    throwOnError(widgetMessagesResult.error, "Failed to load widget messages.");

    for (const session of (sessionsResult.data ?? []) as WidgetSessionRow[]) {
      if (!LIVE_WIDGET_SOURCES.has(session.source) || !session.active_agent_id) {
        continue;
      }

      liveSessionIds.add(session.id);
      liveSessionAgentById.set(session.id, session.active_agent_id);
      workspaceLastActiveAt = pickLatest(workspaceLastActiveAt, session.last_seen_at);
      addConversationId(
        conversationIdsByAgent,
        session.active_agent_id,
        `widget:${session.id}`,
      );
    }

    totalConversationCount += liveSessionIds.size;

    for (const message of (widgetMessagesResult.data ?? []) as WidgetMessageRow[]) {
      if (!liveSessionIds.has(message.widget_session_id)) continue;
      const agentId = message.agent_id ?? liveSessionAgentById.get(message.widget_session_id);
      if (!agentId) continue;

      incrementCount(messageCountByAgent, agentId);
      totalMessageCount += 1;
      workspaceLastActiveAt = pickLatest(workspaceLastActiveAt, message.created_at);
      lastActiveByAgent.set(
        agentId,
        pickLatest(lastActiveByAgent.get(agentId), message.created_at) as string,
      );
    }
  }

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      ownerEmail: (ownerResult.data as { email: string | null } | null)?.email ?? null,
      createdAt: workspace.created_at,
      agentCount: agents.length,
      widgetCount: widgetIds.size,
      conversationCount: totalConversationCount,
      messageCount: totalMessageCount,
      lastActiveAt: workspaceLastActiveAt,
    },
    agents: agents
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        createdAt: agent.created_at,
        conversationCount: conversationIdsByAgent.get(agent.id)?.size ?? 0,
        messageCount: messageCountByAgent.get(agent.id) ?? 0,
        lastActiveAt: lastActiveByAgent.get(agent.id) ?? null,
      }))
      .sort((left, right) => {
        const leftActive = left.lastActiveAt ?? "";
        const rightActive = right.lastActiveAt ?? "";
        if (leftActive !== rightActive) return rightActive.localeCompare(leftActive);
        return right.createdAt.localeCompare(left.createdAt);
      }),
  };
}

/**
 * Returns all widgets for one workspace with usage, leads, and last activity.
 */
export async function getWorkspaceWidgets(
  workspaceId: string,
): Promise<AdminWorkspaceWidgetRow[]> {
  const admin = createAdminClient();
  const widgetsResult = await admin
    .from("widgets")
    .select("id, workspace_id, name, widget_public_key, created_at, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  throwOnError(widgetsResult.error, "Failed to load workspace widgets.");

  const widgets = (widgetsResult.data ?? []) as WidgetRow[];
  if (widgets.length === 0) {
    return [];
  }

  const widgetIds = widgets.map((widget) => widget.id);
  const [sessionsResult, widgetMessagesResult, widgetLeadsResult] = await Promise.all([
    admin
      .from("widget_sessions")
      .select("id, widget_id, active_agent_id, source, last_seen_at")
      .in("widget_id", widgetIds),
    admin
      .from("widget_session_messages")
      .select("widget_session_id, widget_id, agent_id, created_at")
      .in("widget_id", widgetIds),
    admin.from("widget_leads").select("widget_id, created_at").in("widget_id", widgetIds),
  ]);

  throwOnError(sessionsResult.error, "Failed to load widget sessions.");
  throwOnError(widgetMessagesResult.error, "Failed to load widget messages.");
  throwOnError(widgetLeadsResult.error, "Failed to load widget leads.");

  const liveSessions = ((sessionsResult.data ?? []) as WidgetSessionRow[]).filter((session) =>
    LIVE_WIDGET_SOURCES.has(session.source),
  );
  const liveSessionIds = new Set(liveSessions.map((session) => session.id));
  const sessionCountByWidget = new Map<string, number>();
  const messageCountByWidget = new Map<string, number>();
  const leadCountByWidget = new Map<string, number>();
  const lastActiveByWidget = new Map<string, string>();

  for (const session of liveSessions) {
    incrementCount(sessionCountByWidget, session.widget_id);
    lastActiveByWidget.set(
      session.widget_id,
      pickLatest(lastActiveByWidget.get(session.widget_id), session.last_seen_at) as string,
    );
  }

  for (const message of (widgetMessagesResult.data ?? []) as WidgetMessageRow[]) {
    if (!liveSessionIds.has(message.widget_session_id)) continue;
    incrementCount(messageCountByWidget, message.widget_id);
    lastActiveByWidget.set(
      message.widget_id,
      pickLatest(lastActiveByWidget.get(message.widget_id), message.created_at) as string,
    );
  }

  for (const lead of (widgetLeadsResult.data ?? []) as WidgetLeadRow[]) {
    incrementCount(leadCountByWidget, lead.widget_id);
    lastActiveByWidget.set(
      lead.widget_id,
      pickLatest(lastActiveByWidget.get(lead.widget_id), lead.created_at) as string,
    );
  }

  return widgets.map((widget) => ({
    id: widget.id,
    name: widget.name,
    publicKeyDisplay: truncateWidgetPublicKey(widget.widget_public_key),
    createdAt: widget.created_at,
    sessionCount: sessionCountByWidget.get(widget.id) ?? 0,
    messageCount: messageCountByWidget.get(widget.id) ?? 0,
    leadCount: leadCountByWidget.get(widget.id) ?? 0,
    lastActiveAt: lastActiveByWidget.get(widget.id) ?? null,
    status: widget.status === "deployed" ? "active" : "inactive",
  }));
}

/**
 * Returns per-day message totals for one workspace across preview chat and live widgets.
 */
export async function getDailyMessageActivity(
  workspaceId: string,
  days: number,
): Promise<AdminDailyMessageActivityPoint[]> {
  const admin = createAdminClient();
  const dayWindow = buildDayWindow(days);
  const startIso = `${dayWindow[0]?.dateKey ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const [messagesResult, widgetsResult] = await Promise.all([
    admin.from("messages").select("created_at").eq("workspace_id", workspaceId).gte("created_at", startIso),
    admin.from("widgets").select("id, workspace_id, name, widget_public_key, created_at, status").eq("workspace_id", workspaceId),
  ]);

  throwOnError(messagesResult.error, "Failed to load message activity.");
  throwOnError(widgetsResult.error, "Failed to load widgets.");

  const countsByDay = new Map<string, number>(
    dayWindow.map((point) => [point.dateKey, 0]),
  );
  for (const message of (messagesResult.data ?? []) as Array<{ created_at: string }>) {
    const dayKey = message.created_at.slice(0, 10);
    countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1);
  }

  const widgetIds = ((widgetsResult.data ?? []) as WidgetRow[]).map((widget) => widget.id);
  if (widgetIds.length > 0) {
    const [sessionsResult, widgetMessagesResult] = await Promise.all([
      admin.from("widget_sessions").select("id, widget_id, source").in("widget_id", widgetIds),
      admin
        .from("widget_session_messages")
        .select("widget_session_id, created_at")
        .in("widget_id", widgetIds)
        .gte("created_at", startIso),
    ]);

    throwOnError(sessionsResult.error, "Failed to load widget session activity.");
    throwOnError(widgetMessagesResult.error, "Failed to load widget message activity.");

    const liveSessionIds = new Set(
      ((sessionsResult.data ?? []) as Array<{ id: string; source: string }>)
        .filter((session) => LIVE_WIDGET_SOURCES.has(session.source))
        .map((session) => session.id),
    );

    for (const message of (widgetMessagesResult.data ?? []) as Array<{ widget_session_id: string; created_at: string }>) {
      if (!liveSessionIds.has(message.widget_session_id)) continue;
      const dayKey = message.created_at.slice(0, 10);
      countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1);
    }
  }

  return dayWindow.map((point) => ({
    dateKey: point.dateKey,
    label: point.label,
    messageCount: countsByDay.get(point.dateKey) ?? 0,
  }));
}
