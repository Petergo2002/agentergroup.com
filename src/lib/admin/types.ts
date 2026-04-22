export interface AdminOverviewSummary {
  totalWorkspaces: number;
  totalAgents: number;
  totalConversations: number;
  totalMessages: number;
}

export type AdminWorkspaceSortKey =
  | "name"
  | "ownerEmail"
  | "createdAt"
  | "agentCount"
  | "widgetCount"
  | "conversationCount30d"
  | "messageCount30d"
  | "lastActiveAt";

export interface AdminWorkspaceListItem {
  id: string;
  name: string;
  ownerEmail: string | null;
  createdAt: string;
  agentCount: number;
  widgetCount: number;
  conversationCount30d: number;
  messageCount30d: number;
  lastActiveAt: string | null;
}

export interface AdminOverviewData {
  summary: AdminOverviewSummary;
  workspaces: AdminWorkspaceListItem[];
}

export interface AdminWorkspaceDetailSummary {
  id: string;
  name: string;
  ownerEmail: string | null;
  createdAt: string;
  internalAssistantsEnabled: boolean;
  agentCount: number;
  widgetCount: number;
  conversationCount: number;
  messageCount: number;
  lastActiveAt: string | null;
  /** Current subscription plan tier for this workspace. */
  planTier: "free" | "starter" | "premium";
  /** Maximum messages allowed in the current billing cycle. */
  messagesLimit: number;
  /** Messages consumed in the current billing cycle. */
  messagesUsed: number;
  /** Maximum active agents allowed under this plan. */
  agentsLimit: number;
  /** Whether external tool integrations are unlocked. */
  integrationsEnabled: boolean;
}

export interface AdminWorkspaceAgentRow {
  id: string;
  name: string;
  createdAt: string;
  conversationCount: number;
  messageCount: number;
  lastActiveAt: string | null;
}

export interface AdminWorkspaceWidgetRow {
  id: string;
  name: string;
  publicKeyDisplay: string;
  createdAt: string;
  sessionCount: number;
  messageCount: number;
  leadCount: number;
  lastActiveAt: string | null;
  status: "active" | "inactive";
}

export interface AdminWorkspaceDetailData {
  workspace: AdminWorkspaceDetailSummary;
  agents: AdminWorkspaceAgentRow[];
}

export interface AdminDailyMessageActivityPoint {
  dateKey: string;
  label: string;
  messageCount: number;
}
