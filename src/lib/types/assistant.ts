import type { AgentStatus, AgentSurface, MessageRole, ThreadSource } from "./enums";
import type { AgentRecord } from "./agent";

export interface AssistantListItem {
  id: string;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  surface: AgentSurface;
  createdBy: string;
  updatedAt: string;
  threadCount: number;
  lastActivityAt: string | null;
  canEdit: boolean;
}

export interface AssistantThreadSummary {
  id: string;
  title: string;
  source: ThreadSource;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
}

export interface AssistantDownloadAsset {
  url: string;
  filename: string;
  mimeType: string | null;
  label: string;
  embeddedDataBase64?: string | null;
}

export interface AssistantConversationMessage {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  senderName: string | null;
  downloads: AssistantDownloadAsset[];
}

export interface AssistantDetailResponse {
  assistant: AgentRecord;
  canEdit: boolean;
  threads: AssistantThreadSummary[];
  activeThreadId: string | null;
  messages: AssistantConversationMessage[];
}