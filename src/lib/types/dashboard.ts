import type { AgentRecord } from "./agent";
import type { DebugTrace } from "./debug";

export type DashboardAnalyticsRange = "7d" | "30d" | "90d";

export interface DashboardAnalyticsOverview {
  conversations: number;
  messages: number;
  leads: number;
  activeWidgets: number;
  agents: number;
  connectedApps: number;
  failures: number;
}

export interface DashboardAnalyticsAppliedFilters {
  range: DashboardAnalyticsRange;
  widgetId: string | null;
  agentId: string | null;
  search: string;
  sessionStatus: "all" | "active" | "completed";
}

export interface DashboardAnalyticsConversationListItem {
  widgetSessionId: string;
  sessionId: string;
  widgetId: string;
  widgetName: string;
  widgetPublicKey: string;
  widgetAgentId: string | null;
  agentId: string | null;
  agentName: string | null;
  agentLabel: string | null;
  source: "embedded" | "hosted";
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  latestSnippet: string | null;
  pageUrl: string | null;
  referrer: string | null;
  hasLead: boolean;
  leadCount: number;
  leadSummary: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  identitySummary: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface DashboardAnalyticsResponse {
  overview: DashboardAnalyticsOverview;
  filters: {
    widgets: Array<{ id: string; name: string }>;
    agents: Array<{ id: string; name: string }>;
    applied: DashboardAnalyticsAppliedFilters;
  };
  conversations: DashboardAnalyticsConversationListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface DashboardSummaryResponse {
  recentConversations: DashboardAnalyticsConversationListItem[];
  agents: AgentRecord[];
  workspaceSummary: {
    totalWidgets: number;
    liveWidgets: number;
    connectedApps: number;
    knowledgeSources: number;
    leads: number;
  };
}

export interface DashboardConversationDetailResponse {
  conversation: {
    widgetSessionId: string;
    sessionId: string;
    widgetId: string;
    widgetName: string;
    widgetPublicKey: string;
    widgetAgentId: string | null;
    agentId: string | null;
    agentName: string | null;
    agentLabel: string | null;
    source: "embedded" | "hosted";
    startedAt: string;
    lastActivityAt: string;
    pageUrl: string | null;
    referrer: string | null;
  };
  lead: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    message: string | null;
    createdAt: string;
  } | null;
  identitySummary: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  transcript: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
    debugTrace?: DebugTrace | null;
  }>;
}
