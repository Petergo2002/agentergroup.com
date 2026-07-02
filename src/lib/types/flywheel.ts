import type {
  KnowledgeSourceStatus,
  UnansweredQueryStatus,
  VerifiedFactStatus,
  VerifiedFactVisibility,
} from "./enums";

export interface UnansweredQueryRecord {
  id: string;
  workspace_id: string;
  widget_id: string;
  widget_agent_id: string | null;
  agent_id: string;
  widget_session_id: string;
  user_message_id: string | null;
  assistant_message_id: string | null;
  question: string;
  assistant_answer: string;
  context_excerpt: string;
  detection_reason: string;
  confidence: number;
  status: UnansweredQueryStatus;
  duplicate_of: string | null;
  dedupe_hash: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface VerifiedFactRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  unanswered_query_id: string | null;
  created_by: string;
  question: string;
  answer: string;
  status: VerifiedFactStatus;
  visibility: VerifiedFactVisibility;
  knowledge_source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  retired_at: string | null;
}

export interface FlywheelQuestionListItem extends UnansweredQueryRecord {
  agent_name: string | null;
  widget_name: string | null;
  widget_session_public_id: string | null;
  page_url: string | null;
  referrer: string | null;
  last_activity_at: string | null;
  verified_fact: VerifiedFactRecord | null;
  knowledge_source_status: KnowledgeSourceStatus | null;
  knowledge_source_error: string | null;
}

export interface FlywheelQuestionDetail extends FlywheelQuestionListItem {
  conversation_messages: Array<{
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    created_at: string;
  }>;
}
