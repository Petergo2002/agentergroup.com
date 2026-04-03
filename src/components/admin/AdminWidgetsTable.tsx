import type { AdminWorkspaceWidgetRow } from "@/lib/admin/types";
import {
  formatAdminNumber,
} from "@/lib/admin/format";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminStatusDot } from "@/components/admin/AdminStatusDot";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminWidgetsTableProps {
  widgets: AdminWorkspaceWidgetRow[];
  language: PlatformLanguage;
}

export function AdminWidgetsTable({ widgets, language }: AdminWidgetsTableProps) {
  if (widgets.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
        <AdminEmptyState
          title={language === "sv" ? "Inga widgets i detta workspace" : "No widgets in this workspace"}
          description={
            language === "sv"
              ? "Widgets visas här när kunden har skapat och publicerat dem."
              : "Widgets will appear here once this customer creates and deploys them."
          }
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
      <div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.85fr_0.85fr_0.85fr_1fr] gap-4 px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-neutral-500">
        <span>{language === "sv" ? "Widget" : "Widget"}</span>
        <span>{language === "sv" ? "Publik nyckel" : "Public key"}</span>
        <span>{language === "sv" ? "Skapad" : "Created"}</span>
        <span>{language === "sv" ? "Sessioner" : "Sessions"}</span>
        <span>{language === "sv" ? "Meddelanden" : "Messages"}</span>
        <span>{language === "sv" ? "Leads" : "Leads"}</span>
        <span>{language === "sv" ? "Senast aktiv" : "Last active"}</span>
      </div>
      <div>
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="grid grid-cols-[1.6fr_1fr_0.9fr_0.85fr_0.85fr_0.85fr_1fr] gap-4 border-t border-[#1a1a1a] px-6 py-4 text-sm text-neutral-200 transition-colors hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <AdminStatusDot status={widget.status} />
              <span className="font-medium text-white">{widget.name}</span>
            </div>
            <span className="font-mono text-[12px] text-neutral-400">
              {widget.publicKeyDisplay}
            </span>
            <AdminTimestamp value={widget.createdAt} className="text-neutral-300" language={language} />
            <span>{formatAdminNumber(widget.sessionCount, language)}</span>
            <span>{formatAdminNumber(widget.messageCount, language)}</span>
            <span>{formatAdminNumber(widget.leadCount, language)}</span>
            <AdminTimestamp value={widget.lastActiveAt} className="text-neutral-300" language={language} />
          </div>
        ))}
      </div>
    </section>
  );
}
