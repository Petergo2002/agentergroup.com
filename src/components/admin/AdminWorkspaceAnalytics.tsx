import { AdminActivityChart } from "@/components/admin/AdminActivityChart";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import type {
  AdminDailyMessageActivityPoint,
  AdminWorkspaceDetailSummary,
} from "@/lib/admin/types";
import { formatAdminNumber } from "@/lib/admin/format";

interface AdminWorkspaceAnalyticsProps {
  workspace: AdminWorkspaceDetailSummary;
  points: AdminDailyMessageActivityPoint[];
}

export function AdminWorkspaceAnalytics({
  workspace,
  points,
}: AdminWorkspaceAnalyticsProps) {
  const stats = [
    {
      label: "Total conversations",
      value: formatAdminNumber(workspace.conversationCount),
    },
    {
      label: "Total messages",
      value: formatAdminNumber(workspace.messageCount),
    },
    {
      label: "Last active",
      value: null,
    },
  ] as const;

  return (
    <div className="space-y-6 admin-fade-in">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-[#222] bg-[#171717] px-6 py-5"
          >
            <p className="text-[12px] uppercase tracking-[0.14em] text-neutral-500">
              {stat.label}
            </p>
            {stat.label === "Last active" ? (
              <div className="mt-4 text-lg font-medium text-white">
                <AdminTimestamp value={workspace.lastActiveAt} />
              </div>
            ) : (
              <p className="mt-4 text-[28px] font-semibold tracking-tight text-white">
                {stat.value}
              </p>
            )}
          </article>
        ))}
      </div>

      <AdminActivityChart points={points} />
    </div>
  );
}
