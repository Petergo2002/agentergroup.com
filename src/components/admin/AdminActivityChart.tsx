import type { AdminDailyMessageActivityPoint } from "@/lib/admin/types";
import { formatAdminNumber } from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminActivityChartProps {
  points: AdminDailyMessageActivityPoint[];
  language: PlatformLanguage;
}

export function AdminActivityChart({ points, language }: AdminActivityChartProps) {
  const maxCount = Math.max(...points.map((point) => point.messageCount), 1);
  const totalMessages = points.reduce((sum, point) => sum + point.messageCount, 0);

  return (
    <section className="rounded-3xl border border-outline bg-surface p-6 shadow-tactile">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            {language === "sv" ? "Aktivitet" : "Activity"}
          </p>
          <h2 className="mt-3 text-xl font-semibold text-on-surface">
            {language === "sv" ? "Daglig meddelandevolym" : "Daily message volume"}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-on-surface-variant">{language === "sv" ? "Senaste 30 dagarna" : "Last 30 days"}</p>
          <p className="mt-1 text-sm text-on-surface">
            {language === "sv"
              ? `${formatAdminNumber(totalMessages, language)} meddelanden`
              : `${formatAdminNumber(totalMessages, language)} messages`}
          </p>
        </div>
      </div>
      <div className="flex h-64 items-end gap-2">
        {points.map((point, index) => {
          const height = `${Math.max((point.messageCount / maxCount) * 100, point.messageCount > 0 ? 10 : 0)}%`;
          const showLabel = index === 0 || index === points.length - 1 || index % 5 === 0;

          return (
            <div key={point.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-52 w-full items-end rounded-t-xl bg-surface-container-low px-1">
                <div
                  className="animate-chart-grow w-full rounded-t-xl bg-[#FF5C00] transition-opacity hover:opacity-90"
                  style={{ height }}
                  title={
                    language === "sv"
                      ? `${point.label}: ${formatAdminNumber(point.messageCount, language)} meddelanden`
                      : `${point.label}: ${formatAdminNumber(point.messageCount, language)} messages`
                  }
                />
              </div>
              <span className="text-[10px] text-on-surface-variant">
                {showLabel ? point.label : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
