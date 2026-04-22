import type { AdminWorkspaceDetailSummary } from "@/lib/admin/types";
import {
  formatAdminNumber,
} from "@/lib/admin/format";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminWorkspaceSummaryPanelProps {
  workspace: AdminWorkspaceDetailSummary;
  language: PlatformLanguage;
}

export function AdminWorkspaceSummaryPanel({
  workspace,
  language,
}: AdminWorkspaceSummaryPanelProps) {
  const pills = [
    { label: language === "sv" ? "Agenter" : "Agents", value: workspace.agentCount },
    { label: language === "sv" ? "Widgets" : "Widgets", value: workspace.widgetCount },
    { label: language === "sv" ? "Meddelanden" : "Messages", value: workspace.messageCount },
  ] as const;

  return (
    <aside className="sticky top-8 rounded-3xl border border-[#222] bg-[#171717] p-6">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        {language === "sv" ? "Kund" : "Customer"}
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        {workspace.ownerEmail ?? (language === "sv" ? "Ingen ägaradress" : "No owner email")}
      </p>

      <dl className="mt-6 space-y-4 border-t border-[#222] pt-6">
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            {language === "sv" ? "Skapad" : "Created"}
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            <AdminTimestamp value={workspace.createdAt} language={language} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            {language === "sv" ? "Senast aktiv" : "Last active"}
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            <AdminTimestamp value={workspace.lastActiveAt} language={language} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-neutral-600">
            {language === "sv" ? "Konversationer" : "Conversations"}
          </dt>
          <dd className="mt-1 text-sm text-neutral-200">
            {formatAdminNumber(workspace.conversationCount, language)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        {pills.map((pill) => (
          <div
            key={pill.label}
            className="flex-1 rounded-2xl bg-neutral-800/40 px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {pill.label}
            </p>
            <p className="mt-1 text-lg font-medium tracking-tight text-white">
              {formatAdminNumber(pill.value, language)}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
