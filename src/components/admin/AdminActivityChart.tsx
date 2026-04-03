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
    <section className="rounded-3xl border border-[#222] bg-[#171717] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            {language === "sv" ? "Aktivitet" : "Activity"}
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            {language === "sv" ? "Daglig meddelandevolym" : "Daily message volume"}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-500">{language === "sv" ? "Senaste 30 dagarna" : "Last 30 days"}</p>
          <p className="mt-1 text-sm text-neutral-200">
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
              <div className="flex h-52 w-full items-end rounded-t-xl bg-[#121212] px-1">
                <div
                  className="w-full rounded-t-xl bg-[#FF5C00] transition-opacity hover:opacity-90"
                  style={{ height }}
                  title={
                    language === "sv"
                      ? `${point.label}: ${formatAdminNumber(point.messageCount, language)} meddelanden`
                      : `${point.label}: ${formatAdminNumber(point.messageCount, language)} messages`
                  }
                />
              </div>
              <span className="text-[10px] text-neutral-600">
                {showLabel ? point.label : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
