import type { AdminOverviewSummary } from "@/lib/admin/types";
import { formatAdminNumber } from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminStatCardsProps {
  summary: AdminOverviewSummary;
  language: PlatformLanguage;
}

export function AdminStatCards({ summary, language }: AdminStatCardsProps) {
  const items = [
    [language === "sv" ? "Totala workspaces" : "Total workspaces", summary.totalWorkspaces],
    [language === "sv" ? "Totala agenter" : "Total agents", summary.totalAgents],
    [language === "sv" ? "Totala konversationer" : "Total conversations", summary.totalConversations],
    [language === "sv" ? "Totala meddelanden" : "Total messages", summary.totalMessages],
  ] as const;

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <article
          key={label}
          className="rounded-3xl border border-outline bg-surface px-6 py-6 shadow-tactile"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
            {label}
          </p>
          <p className="mt-5 text-[32px] font-semibold tracking-tight text-on-surface">
            {formatAdminNumber(value, language)}
          </p>
        </article>
      ))}
    </section>
  );
}
