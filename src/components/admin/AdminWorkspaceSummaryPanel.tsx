import type { AdminWorkspaceDetailSummary } from "@/lib/admin/types";
import {
  formatAdminNumber,
} from "@/lib/admin/format";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";

interface AdminWorkspaceSummaryPanelProps {
  workspace: AdminWorkspaceDetailSummary;
}

export function AdminWorkspaceSummaryPanel({
  workspace,
}: AdminWorkspaceSummaryPanelProps) {
  const pills = [
    { label: "Agents", value: workspace.agentCount },
    { label: "Widgets", value: workspace.widgetCount },
    { label: "Messages", value: workspace.messageCount },
  ] as const;

  return (
    <aside className="sticky top-8 rounded-3xl border border-[#222] bg-[#171717] p-6">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        Customer
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        {workspace.ownerEmail ?? "No owner email"}
      </p>

      <dl className="mt-6 space-y-4 border-t border-[#222] pt-6">
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            Created
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            <AdminTimestamp value={workspace.createdAt} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            Last active
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            <AdminTimestamp value={workspace.lastActiveAt} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            Conversations
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            {formatAdminNumber(workspace.conversationCount)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <div
            key={pill.label}
            className="rounded-full border border-[#262626] bg-[#121212] px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-600">
              {pill.label}
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {formatAdminNumber(pill.value)}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
