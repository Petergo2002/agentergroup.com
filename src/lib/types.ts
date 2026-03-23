export type AgentStatus = "draft" | "active" | "paused";
export type ConnectionStatus =
  | "pending"
  | "connected"
  | "error"
  | "disconnected";
export type KnowledgeSourceStatus = "pending" | "processing" | "ready" | "failed";
export type KnowledgeSourceType = "text" | "file";
export type WidgetDeploymentStatus = "draft" | "deployed";
export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "waiting_approval";
export type MessageRole = "system" | "user" | "assistant" | "tool";
export type RunStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "waiting_approval";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "not_required";

export interface ProfileRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
}

export interface AvailableWorkspace {
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord;
}

export interface AgentRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  slug: string;
  description: string;
  status: AgentStatus;
  model: string;
  instructions: string;
  starter_prompts: string[];
  timezone: string;
  published_version_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVersionRecord {
  id: string;
  agent_id: string;
  workspace_id: string;
  version: number;
  definition: BuilderDefinition;
  published_by: string;
  created_at: string;
}

export interface ConnectionRecord {
  id: string;
  workspace_id: string;
  provider: string;
  toolkit_slug: string;
  display_name: string;
  status: ConnectionStatus;
  external_id: string | null;
  account_label: string | null;
  toolkit_data: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  source_type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  raw_text: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  chunk_count: number;
  last_processed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkRecord {
  id: string;
  source_id: string;
  workspace_id: string;
  chunk_index: number;
  content: string;
  content_length: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentKnowledgeSourceRecord {
  id: string;
  agent_id: string;
  knowledge_source_id: string;
  created_at: string;
}

export interface DriveImportFileRecord {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  size: string | null;
}

export interface KnowledgeMatchRecord {
  chunk_id: string;
  source_id: string;
  source_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface WidgetQuickAction {
  label: string;
  prompt: string;
  icon?: string | null;
}

export interface WidgetContactFormSettingsRecord {
  submitButtonText?: string;
  successMessage?: string;
  introText?: string;
}

export interface WidgetDeploymentRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  published_version_id: string | null;
  status: WidgetDeploymentStatus;
  widget_public_key: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  text_color: string;
  theme: "dark" | "light";
  language: string;
  home_title: string | null;
  home_subtitle: string | null;
  hosted_enabled: boolean;
  greeting: string;
  placeholder: string;
  show_branding: boolean;
  privacy_policy_url: string | null;
  interaction_mode: "chat" | "contact_form";
  allowed_origins: string[];
  quick_actions: WidgetQuickAction[];
  contact_form_settings: WidgetContactFormSettingsRecord;
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

export interface WidgetRecord {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: WidgetDeploymentStatus;
  widget_public_key: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  text_color: string;
  theme: "dark" | "light";
  language: string;
  home_title: string | null;
  home_subtitle: string | null;
  hosted_enabled: boolean;
  show_branding: boolean;
  privacy_policy_url: string | null;
  allowed_origins: string[];
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

export interface WidgetAgentRecord {
  id: string;
  widget_id: string;
  agent_id: string;
  published_version_id: string | null;
  label: string;
  description: string;
  icon: string | null;
  sort_order: number;
  interaction_mode: "chat" | "contact_form";
  greeting: string;
  placeholder: string;
  show_quick_actions: boolean;
  quick_actions: WidgetQuickAction[];
  contact_form_settings: WidgetContactFormSettingsRecord;
  created_at: string;
  updated_at: string;
}

export interface WidgetSessionRecord {
  id: string;
  widget_id: string;
  session_id: string;
  source: "embedded" | "hosted" | "preview";
  status: "active" | "completed";
  page_url: string | null;
  referrer: string | null;
  origin: string | null;
  active_widget_agent_id: string | null;
  active_agent_id: string | null;
  ended_at: string | null;
  end_reason: ConversationEndReason | null;
  last_user_message_at: string | null;
  last_assistant_message_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface WidgetSessionMessageRecord {
  id: string;
  widget_session_id: string;
  widget_id: string;
  widget_agent_id: string | null;
  agent_id: string | null;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WidgetLeadRecord {
  id: string;
  widget_id: string;
  widget_session_id: string | null;
  widget_agent_id: string | null;
  agent_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  created_at: string;
}

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

/** A single debug event captured during one agent turn. Stored in message metadata. */
export interface DebugEvent {
  /** Event type */
  type:
    | "tool_call"
    | "tool_result"
    | "tool_error"
    | "tool_empty_result"
    | "session_miss"
    | "session_created"
    | "recovery_triggered"
    | "llm_error"
    | "knowledge_hit";
  /** Milliseconds since the start of this agent turn */
  ts: number;
  /** Tool name (for tool_* events) */
  name?: string;
  /** Abbreviated tool arguments */
  args?: Record<string, unknown>;
  /** Abbreviated tool result (first 300 chars if string) */
  result?: unknown;
  /** Error message */
  error?: string;
  /** Which loop iteration (0-indexed) was active */
  iterationIndex?: number;
}

/** Full debug trace for one assistant turn. Stored in assistant message metadata.debugTrace. */
export interface DebugTrace {
  /** Total wall-clock time for this turn in milliseconds */
  durationMs: number;
  /** How many LLM iterations were used */
  iterationsUsed: number;
  /** Tool names that were available */
  toolsAvailable: string[];
  /** Number of knowledge chunks matched */
  knowledgeHits: number;
  /** Ordered list of events that happened during this turn */
  events: DebugEvent[];
  /** True if any error occurred */
  hadError: boolean;
  /** Short human-readable summary of the error */
  errorSummary?: string;
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
  transcript: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
    debugTrace?: DebugTrace | null;
  }>;
}

export interface WidgetDraftPreviewAgentInput {
  agentId: string;
  label: string;
  description: string;
  icon: string | null;
  sortOrder: number;
  interactionMode: "chat" | "contact_form";
  greeting: string;
  placeholder: string;
  showQuickActions: boolean;
  quickActions: WidgetQuickAction[];
  contactFormSettings: WidgetContactFormSettingsRecord;
}

export interface WidgetDraftPreviewInput {
  widget: {
    name: string;
    brandName: string;
    logoUrl: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    theme: "dark" | "light";
    language: string;
    homeTitle: string | null;
    homeSubtitle: string | null;
    showBranding: boolean;
    privacyPolicyUrl: string;
    allowedOrigins: string[];
  };
  agents: WidgetDraftPreviewAgentInput[];
}

export interface WidgetPreviewDraftRecord {
  id: string;
  widget_id: string;
  workspace_id: string;
  created_by: string;
  revision: string;
  payload: WidgetDraftPreviewInput;
  expires_at: string;
  created_at: string;
}

export interface WidgetRuntimeConfig {
  widgetId: string;
  widgetPublicKey: string;
  preview: boolean;
  brand: {
    name: string;
    logoUrl: string | null;
    privacyPolicyUrl: string | null;
  };
  widget: {
    theme: "dark" | "light";
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    language: string;
    showBranding: boolean;
  };
  home: {
    mode: "single_auto" | "chooser";
    title: string | null;
    subtitle: string | null;
  };
  agents: Array<{
    widgetAgentId: string;
    agentId: string;
    label: string;
    description: string;
    icon: string | null;
    interactionMode: "chat" | "contact_form";
    greeting: string;
    placeholder: string;
    quickActions: WidgetQuickAction[];
    contactFormSettings: WidgetContactFormSettingsRecord;
    endChatPolicy: EndChatPolicy;
    gmailRecipientPolicy: GmailRecipientPolicy;
    googleCalendarSelection: GoogleCalendarSelection;
  }>;
}

export interface ThreadRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  thread_id: string;
  workspace_id: string;
  role: MessageRole;
  content: string;
  tool_name: string | null;
  tool_call_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RunRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  thread_id: string | null;
  status: RunStatus;
  model: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface RunStepRecord {
  id: string;
  run_id: string;
  workspace_id: string;
  agent_id: string;
  step_key: string;
  step_type: string;
  title: string;
  detail: string | null;
  status: RunStepStatus;
  payload: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface RunApprovalRecord {
  id: string;
  run_id: string;
  workspace_id: string;
  agent_id: string;
  step_id: string | null;
  status: ApprovalStatus;
  title: string;
  detail: string | null;
  requested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  run_id: string | null;
  actor_id: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ConversationEndReason =
  | "assistant_suggestion"
  | "inactivity_timeout";

export interface EndChatPolicy {
  enabled: boolean;
  inactivityTimeoutSeconds: number | null;
  allowAssistantSuggestion: boolean;
}

export type GmailRecipientMode = "ai_decides" | "specific_email";

export interface GmailRecipientPolicy {
  mode: GmailRecipientMode;
  specificEmail: string | null;
}

export interface GoogleCalendarSelection {
  connectionId: string | null;
  calendarId: string | null;
  calendarLabel: string | null;
  timezone: string | null;
  includePrimaryCalendar: boolean;
}

export interface EndChatMetadata {
  suggested: boolean;
  sessionCompleted: boolean;
  reason: ConversationEndReason | null;
  source: "assistant" | "system";
  summary?: string | null;
}

export type BuilderNodeKind =
  | "trigger"
  | "agent"
  | "knowledge"
  | "gmail"
  | "googlecalendar"
  | "endchat"
  | "output";

export type BuilderNodeStatus = "active" | "idle" | "error";
export type BuilderNodeBadgeTone = "default" | "success" | "warning" | "error";

interface BaseBuilderNodeData extends Record<string, unknown> {
  kind: BuilderNodeKind;
  label: string;
  type?: string;
  icon?: string;
  description?: string;
  status?: BuilderNodeStatus;
  badgeText?: string;
  badgeTone?: BuilderNodeBadgeTone;
  locked?: boolean;
}

export interface TriggerBuilderNodeData extends BaseBuilderNodeData {
  kind: "trigger";
  locked: true;
}

export interface AgentBuilderNodeData extends BaseBuilderNodeData {
  kind: "agent";
  showConfidence?: boolean;
  confidenceValue?: number;
  locked: true;
}

export interface KnowledgeBuilderNodeData extends BaseBuilderNodeData {
  kind: "knowledge";
  sourceIds: string[];
}

export interface GmailBuilderNodeData extends BaseBuilderNodeData {
  kind: "gmail";
  integrationSlug: "gmail";
  connectionId: string | null;
  recipientMode: GmailRecipientMode;
  recipientEmail: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface GoogleCalendarBuilderNodeData extends BaseBuilderNodeData {
  kind: "googlecalendar";
  integrationSlug: "googlecalendar";
  connectionId: string | null;
  timezone: string | null;
  calendarId: string | null;
  calendarLabel: string | null;
  includePrimaryCalendar: boolean;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface EndChatBuilderNodeData extends BaseBuilderNodeData {
  kind: "endchat";
  inactivityTimeoutSeconds: number | null;
  allowAssistantSuggestion: boolean;
}

export interface OutputBuilderNodeData extends BaseBuilderNodeData {
  kind: "output";
  locked: true;
}

export type BuilderNodeData =
  | TriggerBuilderNodeData
  | AgentBuilderNodeData
  | KnowledgeBuilderNodeData
  | GmailBuilderNodeData
  | GoogleCalendarBuilderNodeData
  | EndChatBuilderNodeData
  | OutputBuilderNodeData;

export interface BuilderDefinition {
  nodes: unknown[];
  edges: unknown[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  config: {
    model: string;
    instructions: string;
    starterPrompts: string[];
    timezone: string;
  };
}

export interface AppWorkspaceContext {
  profile: ProfileRecord;
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord;
  workspaces: AvailableWorkspace[];
}
