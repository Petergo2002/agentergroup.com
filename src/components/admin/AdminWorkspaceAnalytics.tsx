import { AdminActivityChart } from "@/components/admin/AdminActivityChart";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import type {
  AdminDailyMessageActivityPoint,
  AdminWorkspaceDetailSummary,
} from "@/lib/admin/types";
import { formatAdminNumber } from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminWorkspaceAnalyticsProps {
  workspace: AdminWorkspaceDetailSummary;
  points: AdminDailyMessageActivityPoint[];
  language: PlatformLanguage;
}

export function AdminWorkspaceAnalytics({
  workspace,
  points,
  language,
}: AdminWorkspaceAnalyticsProps) {
  const stats = [
    {
      label: language === "sv" ? "Totala konversationer" : "Total conversations",
      value: formatAdminNumber(workspace.conversationCount, language),
    },
    {
      label: language === "sv" ? "Totala meddelanden" : "Total messages",
      value: formatAdminNumber(workspace.messageCount, language),
    },
    {
      label: language === "sv" ? "Senast aktiv" : "Last active",
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
            {stat.label === (language === "sv" ? "Senast aktiv" : "Last active") ? (
              <div className="mt-4 text-lg font-medium text-white">
                <AdminTimestamp value={workspace.lastActiveAt} language={language} />
              </div>
            ) : (
              <p className="mt-4 text-[28px] font-semibold tracking-tight text-white">
                {stat.value}
              </p>
            )}
          </article>
        ))}
      </div>

      <AdminActivityChart points={points} language={language} />
    </div>
  );
}
