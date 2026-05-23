import type {
  BuilderNodeData,
  CalBuilderNodeData,
  ConnectionRecord,
  GoogleCalendarBuilderNodeData,
} from "@/lib/types";

export type ToolConnectionKind =
  | "gmail"
  | "outlook"
  | "slack"
  | "hubspot"
  | "shopify"
  | "googleads"
  | "googlecalendar"
  | "cal";

export type ToolConnectionNodeData = Extract<
  BuilderNodeData,
  { kind: ToolConnectionKind }
>;

export interface ResolvedToolConnection<T extends ToolConnectionNodeData> {
  data: T;
  selectedConnection: ConnectionRecord | null;
  displayConnection: ConnectionRecord | null;
  changed: boolean;
}

export function getToolConnectionsByKind(
  connections: ConnectionRecord[],
  kind: ToolConnectionKind,
) {
  return connections
    .filter((connection) => connection.toolkit_slug === kind)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function getSingleToolConnection(
  connections: ConnectionRecord[],
  kind: ToolConnectionKind,
): ConnectionRecord | null {
  const matches = getToolConnectionsByKind(connections, kind);
  if (matches.length === 0) return null;
  const connected = matches.find((connection) => connection.status === "connected");
  return connected ?? matches[0];
}

function clearAccountSpecificSelection<T extends ToolConnectionNodeData>(data: T): T {
  if (data.kind === "googlecalendar") {
    const next: GoogleCalendarBuilderNodeData = {
      ...data,
      timezone: null,
      calendarId: null,
      calendarLabel: null,
    };
    return next as T;
  }

  if (data.kind === "cal") {
    const next: CalBuilderNodeData = {
      ...data,
      timezone: null,
      eventTypeId: null,
      eventTypeLabel: null,
    };
    return next as T;
  }

  return data;
}

export function resolveToolNodeConnection<T extends ToolConnectionNodeData>(
  data: T,
  connections: ConnectionRecord[],
): ResolvedToolConnection<T> {
  const currentConnection = data.connectionId
    ? connections.find((connection) => connection.id === data.connectionId) ?? null
    : null;
  const currentIsValid =
    currentConnection?.toolkit_slug === data.kind &&
    currentConnection.status === "connected";
  const connectedConnection =
    getToolConnectionsByKind(connections, data.kind).find(
      (connection) => connection.status === "connected",
    ) ?? null;
  const selectedConnection = currentIsValid
    ? currentConnection
    : connectedConnection;
  const nextConnectionId = selectedConnection?.id ?? null;
  const changed = data.connectionId !== nextConnectionId;
  const displayConnection =
    selectedConnection ?? getSingleToolConnection(connections, data.kind);

  if (!changed) {
    return {
      data,
      selectedConnection,
      displayConnection,
      changed: false,
    };
  }

  return {
    data: {
      ...clearAccountSpecificSelection(data),
      connectionId: nextConnectionId,
    } as T,
    selectedConnection,
    displayConnection,
    changed: true,
  };
}
