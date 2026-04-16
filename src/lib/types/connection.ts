import type { ConnectionStatus } from "./enums";

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
  created_by: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}