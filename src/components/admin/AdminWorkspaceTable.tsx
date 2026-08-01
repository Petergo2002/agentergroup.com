import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminStatusDot } from "@/components/admin/AdminStatusDot";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import {
  formatAdminNumber,
  getAdminActivityState,
} from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";
import type {
  AdminWorkspaceListItem,
  AdminWorkspaceSortKey,
} from "@/lib/admin/types";

interface AdminWorkspaceTableProps {
  workspaces: AdminWorkspaceListItem[];
  sortKey: AdminWorkspaceSortKey;
  direction: "asc" | "desc";
  basePath: "/admin" | "/admin/customers";
  language: PlatformLanguage;
}

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
  language,
}: AdminWorkspaceTableProps) {
  const columns: Array<{ key: AdminWorkspaceSortKey; label: string }> = [
    { key: "name", label: language === "sv" ? "Workspace" : "Workspace" },
    { key: "ownerEmail", label: language === "sv" ? "Ägarens e-post" : "Owner email" },
    { key: "createdAt", label: language === "sv" ? "Skapad" : "Created" },
    { key: "agentCount", label: language === "sv" ? "Agenter" : "Agents" },
    { key: "widgetCount", label: language === "sv" ? "Widgets" : "Widgets" },
    { key: "conversationCount30d", label: language === "sv" ? "Konversationer (30 d)" : "Conversations (30d)" },
    { key: "messageCount30d", label: language === "sv" ? "Meddelanden (30 d)" : "Messages (30d)" },
    { key: "lastActiveAt", label: language === "sv" ? "Senast aktiv" : "Last active" },
  ];

  if (workspaces.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-outline bg-surface shadow-tactile">
        <AdminEmptyState
          title={language === "sv" ? "Inga kunder ännu" : "No customers yet"}
          description={
            language === "sv"
              ? "Workspaces visas här så snart någon börjar använda produkten."
              : "Workspaces will appear here as soon as people start using the product."
          }
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-outline bg-surface shadow-tactile">
      <div className="grid grid-cols-[1.45fr_1.4fr_0.8fr_0.65fr_0.65fr_1fr_1fr_1fr] gap-4 border-b border-outline bg-surface-container-low px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
        {columns.map((column) => (
          <Link
            key={column.key}
            href={buildSortHref(basePath, sortKey, direction, column.key)}
            className="flex items-center gap-2 transition-colors hover:text-on-surface"
          >
            <span>{column.label}</span>
            <SortIcon active={sortKey === column.key} direction={direction} />
          </Link>
        ))}
      </div>
      <div className="divide-y divide-outline">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/admin/workspaces/${workspace.id}`}
            className="group grid grid-cols-[1.45fr_1.4fr_0.8fr_0.65fr_0.65fr_1fr_1fr_1fr] gap-4 px-6 py-4 text-sm text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <div className="flex items-center gap-3">
              <AdminStatusDot status={getAdminActivityState(workspace.lastActiveAt)} />
              <div className="min-w-0">
                <span className="block truncate font-medium text-on-surface">
                  {workspace.name}
                </span>
                {!workspace.onboardingCompleted ? (
                  <span className="mt-1 inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
                    {language === "sv" ? "Väntar aktivering" : "Pending activation"}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="truncate text-on-surface-variant">
              {workspace.ownerEmail ?? (language === "sv" ? "Okänd" : "Unknown")}
            </span>
            <AdminTimestamp value={workspace.createdAt} className="text-on-surface-variant" language={language} />
            <span>{formatAdminNumber(workspace.agentCount, language)}</span>
            <span>{formatAdminNumber(workspace.widgetCount, language)}</span>
            <span>{formatAdminNumber(workspace.conversationCount30d, language)}</span>
            <span>{formatAdminNumber(workspace.messageCount30d, language)}</span>
            <span className="flex items-center justify-between gap-3">
              <AdminTimestamp value={workspace.lastActiveAt} className="text-on-surface-variant" language={language} />
              <ChevronRight className="h-4 w-4 text-on-surface-variant/40 transition-transform group-hover:translate-x-0.5 group-hover:text-on-surface-variant" strokeWidth={1.8} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
