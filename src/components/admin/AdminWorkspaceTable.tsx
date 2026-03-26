import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminStatusDot } from "@/components/admin/AdminStatusDot";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import {
  formatAdminNumber,
  getAdminActivityState,
} from "@/lib/admin/format";
import type {
  AdminWorkspaceListItem,
  AdminWorkspaceSortKey,
} from "@/lib/admin/types";

interface AdminWorkspaceTableProps {
  workspaces: AdminWorkspaceListItem[];
  sortKey: AdminWorkspaceSortKey;
  direction: "asc" | "desc";
  basePath: "/admin" | "/admin/customers";
}

const columns: Array<{ key: AdminWorkspaceSortKey; label: string }> = [
  { key: "name", label: "Workspace" },
  { key: "ownerEmail", label: "Owner email" },
  { key: "createdAt", label: "Created" },
  { key: "agentCount", label: "Agents" },
  { key: "widgetCount", label: "Widgets" },
  { key: "conversationCount30d", label: "Conversations (30d)" },
  { key: "messageCount30d", label: "Messages (30d)" },
  { key: "lastActiveAt", label: "Last active" },
];

function buildSortHref(
  basePath: "/admin" | "/admin/customers",
  currentSort: AdminWorkspaceSortKey,
  currentDirection: "asc" | "desc",
  nextSort: AdminWorkspaceSortKey,
) {
  const nextDirection =
    currentSort === nextSort && currentDirection === "desc" ? "asc" : "desc";

  return `${basePath}?sort=${nextSort}&direction=${nextDirection}`;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />;
  }

  return direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.8} />
  );
}

export function AdminWorkspaceTable({
  workspaces,
  sortKey,
  direction,
  basePath,
}: AdminWorkspaceTableProps) {
  if (workspaces.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
        <AdminEmptyState
          title="No customers yet"
          description="Workspaces will appear here as soon as people start using the product."
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
      <div className="grid grid-cols-[1.45fr_1.4fr_0.8fr_0.65fr_0.65fr_1fr_1fr_1fr] gap-4 px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-neutral-500">
        {columns.map((column) => (
          <Link
            key={column.key}
            href={buildSortHref(basePath, sortKey, direction, column.key)}
            className="flex items-center gap-2 transition-colors hover:text-white"
          >
            <span>{column.label}</span>
            <SortIcon active={sortKey === column.key} direction={direction} />
          </Link>
        ))}
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/admin/workspaces/${workspace.id}`}
            className="group grid grid-cols-[1.45fr_1.4fr_0.8fr_0.65fr_0.65fr_1fr_1fr_1fr] gap-4 px-6 py-4 text-sm text-neutral-200 transition-colors hover:bg-white/[0.025]"
          >
            <div className="flex items-center gap-3">
              <AdminStatusDot status={getAdminActivityState(workspace.lastActiveAt)} />
              <span className="font-medium text-white">{workspace.name}</span>
            </div>
            <span className="truncate text-neutral-400">
              {workspace.ownerEmail ?? "Unknown"}
            </span>
            <AdminTimestamp value={workspace.createdAt} className="text-neutral-300" />
            <span>{formatAdminNumber(workspace.agentCount)}</span>
            <span>{formatAdminNumber(workspace.widgetCount)}</span>
            <span>{formatAdminNumber(workspace.conversationCount30d)}</span>
            <span>{formatAdminNumber(workspace.messageCount30d)}</span>
            <span className="flex items-center justify-between gap-3">
              <AdminTimestamp value={workspace.lastActiveAt} className="text-neutral-300" />
              <ChevronRight className="h-4 w-4 text-neutral-700 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-400" strokeWidth={1.8} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
