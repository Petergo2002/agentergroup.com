export interface ConnectionSyncAccount {
  toolkitSlug: string;
  displayName: string;
  status: string;
  externalId: string | null;
  accountLabel?: string | null;
  toolkitData: Record<string, unknown>;
}

export interface ConnectionSyncRow {
  workspace_id: string;
  provider: "composio";
  toolkit_slug: string;
  display_name: string;
  status: string;
  external_id: string | null;
  account_label: string;
  toolkit_data: Record<string, unknown>;
  created_by: string;
  last_synced_at: string;
}

export function buildConnectionSyncRows(
  accounts: ConnectionSyncAccount[],
  input: {
    workspaceId: string;
    userId: string;
    syncedAt: string;
  },
): ConnectionSyncRow[] {
  return accounts.map((account) => ({
    workspace_id: input.workspaceId,
    provider: "composio",
    toolkit_slug: account.toolkitSlug,
    display_name: account.displayName,
    status: account.status,
    external_id: account.externalId,
    account_label: account.accountLabel ?? "default",
    toolkit_data: account.toolkitData,
    created_by: input.userId,
    last_synced_at: input.syncedAt,
  }));
}

export async function persistConnectionSyncRows(
  rows: ConnectionSyncRow[],
  upsert: (
    rows: ConnectionSyncRow[],
  ) => Promise<{ error: { message: string } | null }>,
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await upsert(rows);

  if (error) {
    throw new Error(error.message);
  }
}
