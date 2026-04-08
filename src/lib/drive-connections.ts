export interface DriveConnectionLike {
  id: string;
  status: string;
  external_id: string | null;
  toolkit_data: Record<string, unknown> | null;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getDriveConnectedAccountId(
  connection: Pick<DriveConnectionLike, "external_id" | "toolkit_data">,
) {
  return (
    connection.external_id ??
    pickString(connection.toolkit_data?.id) ??
    pickString(connection.toolkit_data?.connectedAccountId)
  );
}

export function getDriveComposioUserId(
  connection: Pick<DriveConnectionLike, "toolkit_data">,
) {
  return pickString(connection.toolkit_data?.composioUserId);
}

export function resolveDriveConnection(
  connections: DriveConnectionLike[],
  requestedConnectionId?: string | null,
) {
  const normalizedRequestedConnectionId = requestedConnectionId?.trim() ?? "";

  if (connections.length === 0) {
    throw new Error(
      "Google Drive must be connected before you can import files.",
    );
  }

  if (normalizedRequestedConnectionId) {
    const requestedConnection =
      connections.find((connection) => connection.id === normalizedRequestedConnectionId) ??
      null;

    if (!requestedConnection) {
      throw new Error("The selected Google Drive account was not found.");
    }

    return requestedConnection;
  }

  if (connections.length === 1) {
    return connections[0];
  }

  throw new Error("Select a Google Drive account before browsing files.");
}
