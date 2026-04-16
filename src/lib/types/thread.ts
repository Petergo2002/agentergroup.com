import type { MessageRole, RunStatus, RunStepStatus, ApprovalStatus, ThreadSource } from "./enums";

export interface ThreadRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  source: ThreadSource;
  title: string;
  created_by: string;
  active_turn_request_id: string | null;
  active_turn_started_at: string | null;
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
  created_by: string | null;
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