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