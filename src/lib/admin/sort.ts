import type {
  AdminWorkspaceListItem,
  AdminWorkspaceSortKey,
} from "@/lib/admin/types";

export function resolveAdminWorkspaceSortKey(
  value: string | undefined,
): AdminWorkspaceSortKey {
  const sortKey = value ?? "lastActiveAt";
  const validSortKeys: AdminWorkspaceSortKey[] = [
    "name",
    "ownerEmail",
    "createdAt",
    "agentCount",
    "widgetCount",
    "conversationCount30d",
    "messageCount30d",
    "lastActiveAt",
  ];

  return validSortKeys.includes(sortKey as AdminWorkspaceSortKey)
    ? (sortKey as AdminWorkspaceSortKey)
    : "lastActiveAt";
}

export function sortAdminWorkspaces(
  workspaces: AdminWorkspaceListItem[],
  sortKey: AdminWorkspaceSortKey,
  direction: "asc" | "desc",
) {
  return [...workspaces].sort((left, right) => {
    const leftValue = left[sortKey] ?? "";
    const rightValue = right[sortKey] ?? "";
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));

    return direction === "asc" ? comparison : -comparison;
  });
}
