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

export type ConnectionAuthLinkStatus = "pending" | "completed" | "revoked";

export interface ConnectionAuthLinkRecord {
  id: string;
  workspace_id: string;
  toolkit_slug: string;
  created_by: string;
  token_hash: string;
  status: ConnectionAuthLinkStatus;
  expires_at: string;
  completed_connection_id: string | null;
  created_at: string;
  updated_at: string;
}
