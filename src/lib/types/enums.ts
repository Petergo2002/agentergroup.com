export type AgentStatus = "draft" | "active" | "paused";
export type AgentSurface = "assistant" | "widget";
export type ConnectionStatus =
  | "pending"
  | "connected"
  | "error"
  | "disconnected";
export type KnowledgeSourceStatus = "pending" | "processing" | "ready" | "failed";
export type KnowledgeSourceType = "text" | "file" | "website";
export type WidgetDeploymentStatus = "draft" | "deployed";
export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "waiting_approval";
export type MessageRole = "system" | "user" | "assistant" | "tool";
export type ThreadSource = "preview" | "assistant";
export type RunStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "waiting_approval";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "not_required";

export type BuilderNodeKind =
  | "trigger"
  | "agent"
  | "knowledge"
  | "gmail"
  | "outlook"
  | "googlecalendar"
  | "cal"
  | "endchat";

export type BuilderNodeStatus = "active" | "idle" | "error";
export type BuilderNodeBadgeTone = "default" | "success" | "warning" | "error";