import type { AdminOverviewSummary } from "@/lib/admin/types";
import { formatAdminNumber } from "@/lib/admin/format";

interface AdminStatCardsProps {
  summary: AdminOverviewSummary;
}

export function AdminStatCards({ summary }: AdminStatCardsProps) {
  const items = [
    ["Total workspaces", summary.totalWorkspaces],
    ["Total agents", summary.totalAgents],
    ["Total conversations", summary.totalConversations],
    ["Total messages", summary.totalMessages],
  ] as const;

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <article
          key={label}
          className="rounded-3xl border border-[#222] bg-[#171717] px-6 py-6"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </p>
          <p className="mt-5 text-[32px] font-semibold tracking-tight text-white">
            {formatAdminNumber(value)}
          </p>
        </article>
      ))}
    </section>
  );
}
