export type AgentAutomationStatus = "draft" | "provisioning" | "active" | "paused" | "error";
export type AutomationEventStatus = "received" | "processing" | "processed" | "ignored" | "failed";

export interface AgentAutomationRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  connection_id: string | null;
  provider: "composio";
  toolkit_slug: "gmail";
  trigger_slug: string;
  trigger_config: Record<string, unknown>;
  composio_trigger_id: string | null;
  status: AgentAutomationStatus;
  last_event_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationEventRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  automation_id: string;
  run_id: string | null;
  external_event_id: string;
  trigger_slug: string;
  payload: Record<string, unknown>;
  status: AutomationEventStatus;
  created_at: string;
  updated_at: string;
}
