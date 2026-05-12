import type { ConnectionRecord } from "@/lib/types";

/** Connection helpers for mapping workspace-scoped Composio identities to stored records. */

/**
 * Builds the canonical Composio user id for a workspace.
 *
 * @param workspaceId The workspace that owns the connection.
 * @returns The workspace-scoped Composio user id.
 */
export function buildWorkspaceComposioUserId(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

/**
 * Reads the stored Composio user id from a connection payload.
 *
 * @param connection The connection row or partial connection payload.
 * @returns The normalized Composio user id, or `null` when unavailable.
 */
export function getConnectionComposioUserId(
  connection:
    | { toolkit_data: Record<string, unknown> | null | undefined }
    | Pick<ConnectionRecord, "toolkit_data">,
): string | null {
  const value = connection.toolkit_data?.composioUserId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolves the expected workspace-scoped Composio user id for a connection.
 *
 * @param connection The connection row.
 * @returns The Composio user id the connection should be associated with.
 */
export function getExpectedConnectionComposioUserId(
  connection: Pick<ConnectionRecord, "workspace_id">,
): string {
  return buildWorkspaceComposioUserId(connection.workspace_id);
}

/**
 * Checks whether a connection is scoped to the expected workspace Composio user.
 *
 * @param connection The connection row to validate.
 * @returns `true` when the stored Composio identity matches the workspace scope.
 */
export function isConnectionScopedToExpectedComposioUser(
  connection: {
    workspace_id: string;
    toolkit_data: Record<string, unknown> | null | undefined;
  },
): boolean {
  return (
    getConnectionComposioUserId(connection) ===
    getExpectedConnectionComposioUserId(connection)
  );
}

/**
 * Returns the effective connection status after validating workspace scoping.
 *
 * @param connection The connection row to evaluate.
 * @returns The stored status when scoped correctly, otherwise `disconnected`.
 */
export function getEffectiveConnectionStatus(
  connection: {
    workspace_id: string;
    toolkit_data: Record<string, unknown> | null | undefined;
    status: ConnectionRecord["status"];
  },
): ConnectionRecord["status"] {
  return isConnectionScopedToExpectedComposioUser(connection)
    ? connection.status
    : "disconnected";
}

export function sortConnectedItemsFirst<T extends { status: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.status === "connected") - Number(a.status === "connected"),
  );
}
