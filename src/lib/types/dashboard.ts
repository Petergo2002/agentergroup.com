import type { AgentRecord } from "./agent";
import type { DebugTrace } from "./debug";
import type { LeadConversationSummary } from "./widget";

export type DashboardAnalyticsRange = "7d" | "30d" | "90d";
export type DashboardAutomationStatusFilter =
  | "all"
  | "received"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export interface DashboardAnalyticsOverview {
  conversations: number;
  messages: number;
  leads: number;
  activeWidgets: number;
  agents: number;
  connectedApps: number;
  failures: number;
}

export interface DashboardAutomationAgentSummary {
  agentId: string;
  agentName: string;
  status: string;
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  actionTaken: number;
  noAction: number;
  needsInput: number;
  actionFailed: number;
  lastEventAt: string | null;
  activityHref: string;
}

export interface DashboardAutomationFailureSummary {
  eventId: string;
  runId: string | null;
  agentId: string;
  agentName: string;
  triggerLabel: string;
  eventStatus: string;
  runStatus: string | null;
  decision: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
  activityHref: string;
}

export interface DashboardAutomationTrendPoint {
  date: string;
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
}

export interface DashboardAutomationAnalytics {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  actionTaken: number;
  noAction: number;
  needsInput: number;
  actionFailed: number;
  successRate: number;
  trend: DashboardAutomationTrendPoint[];
  agents: DashboardAutomationAgentSummary[];
  recentFailures: DashboardAutomationFailureSummary[];
}

export interface DashboardAnalyticsAppliedFilters {
  range: DashboardAnalyticsRange;
  widgetId: string | null;
  agentId: string | null;
  automationStatus: DashboardAutomationStatusFilter;
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
  automation: DashboardAutomationAnalytics;
  filters: {
    widgets: Array<{ id: string; name: string }>;
    agents: Array<{ id: string; name: string; surface: string }>;
    applied: DashboardAnalyticsAppliedFilters;
  };
  conversations: DashboardAnalyticsConversationListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface DashboardLatestActivityResponse {
  latestConversation: Pick<
    DashboardAnalyticsConversationListItem,
    | "widgetSessionId"
    | "widgetId"
    | "widgetName"
    | "agentId"
    | "agentName"
    | "agentLabel"
    | "latestSnippet"
    | "lastActivityAt"
  > | null;
  newLeadCount: number;
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
    email: string | null;
    phone: string | null;
    message: string | null;
    createdAt: string;
  } | null;
  identitySummary: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  aiSummary: LeadConversationSummary | null;
  transcript: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
    debugTrace?: DebugTrace | null;
  }>;
}
