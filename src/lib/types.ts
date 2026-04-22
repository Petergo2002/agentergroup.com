/**
 * Barrel re-export for all shared application types.
 *
 * Import from `@/lib/types` instead of reaching into subdirectories.
 */

export type {
  AgentStatus,
  AgentSurface,
  ConnectionStatus,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  WidgetDeploymentStatus,
  RunStatus,
  MessageRole,
  ThreadSource,
  RunStepStatus,
  ApprovalStatus,
  BuilderNodeKind,
  BuilderNodeStatus,
  BuilderNodeBadgeTone,
} from "./types/enums";

export type {
  ProfileRecord,
  WorkspaceRecord,
  WorkspaceMemberRecord,
  AvailableWorkspace,
  WorkspaceInviteStatus,
  WorkspaceInviteRecord,
  ExpandedWorkspaceInviteRecord,
  WorkspaceMemberWithProfile,
  AppWorkspaceContext,
} from "./types/workspace";

export type {
  PlanTier,
  WorkspaceSubscriptionRecord,
} from "./types/subscription";

export type { AgentRecord, AgentVersionRecord } from "./types/agent";

export type { ConnectionRecord } from "./types/connection";

export type {
  KnowledgeSourceRecord,
  KnowledgeChunkRecord,
  AgentKnowledgeSourceRecord,
  DriveImportFileRecord,
  KnowledgeMatchRecord,
} from "./types/knowledge";

export type {
  WidgetQuickAction,
  WidgetContactFormSettingsRecord,
} from "./types/widget-shared";

export type {
  WidgetDeploymentRecord,
  WidgetRecord,
  WidgetAgentRecord,
  WidgetSessionRecord,
  WidgetSessionMessageRecord,
  WidgetLeadRecord,
} from "./types/widget";

export type {
  PrivacySubjectLookupMode,
  PrivacySubjectLookupQuery,
  PrivacyLeadMatch,
  PrivacySessionMatch,
  PrivacyTranscriptMatch,
  PrivacySubjectLookupSummary,
  PrivacySubjectLookupResponse,
  PrivacyExportMessage,
  PrivacySubjectExportPayload,
  PrivacyDeleteSummary,
  PrivacyDeleteResponse,
  PrivacyRetentionRunSummary,
} from "./types/privacy";

export type {
  DashboardAnalyticsRange,
  DashboardAnalyticsOverview,
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsResponse,
  DashboardSummaryResponse,
  DashboardConversationDetailResponse,
} from "./types/dashboard";

export type {
  AssistantListItem,
  AssistantThreadSummary,
  AssistantDownloadAsset,
  AssistantConversationMessage,
  AssistantDetailResponse,
} from "./types/assistant";

export type { DebugEvent, DebugTrace } from "./types/debug";

export type {
  WidgetDraftPreviewAgentInput,
  WidgetDraftPreviewInput,
  WidgetPreviewDraftRecord,
  WidgetRuntimeConfig,
} from "./types/widget-preview";

export type {
  ThreadRecord,
  MessageRecord,
  RunRecord,
  RunStepRecord,
  RunApprovalRecord,
} from "./types/thread";

export type { AuditLogRecord } from "./types/audit";

export type {
  ConversationEndReason,
  EndChatPolicy,
  GmailRecipientMode,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
  CalSelection,
  EndChatMetadata,
} from "./types/policy";

export type {
  BaseBuilderNodeData,
  TriggerBuilderNodeData,
  AgentBuilderNodeData,
  KnowledgeBuilderNodeData,
  GmailBuilderNodeData,
  OutlookBuilderNodeData,
  GoogleCalendarBuilderNodeData,
  CalBuilderNodeData,
  EndChatBuilderNodeData,
  BuilderNodeData,
  BuilderDefinition,
} from "./types/builder";