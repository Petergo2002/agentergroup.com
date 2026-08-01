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
    <aside className="sticky top-8 rounded-3xl border border-outline bg-surface p-6 shadow-tactile">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">
        {language === "sv" ? "Kund" : "Customer"}
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-on-surface">
        {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        {workspace.ownerEmail ?? (language === "sv" ? "Ingen ägaradress" : "No owner email")}
      </p>
      <div
        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
          workspace.onboardingCompleted
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}
      >
        {workspace.onboardingCompleted
          ? language === "sv" ? "Aktiv" : "Active"
          : language === "sv" ? "Väntar aktivering" : "Pending activation"}
      </div>

      <dl className="mt-6 space-y-4 border-t border-outline pt-6">
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
            {language === "sv" ? "Skapad" : "Created"}
          </dt>
          <dd className="mt-1 text-sm text-on-surface">
            <AdminTimestamp value={workspace.createdAt} language={language} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
            {language === "sv" ? "Senast aktiv" : "Last active"}
          </dt>
          <dd className="mt-1 text-sm text-on-surface">
            <AdminTimestamp value={workspace.lastActiveAt} language={language} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
            {language === "sv" ? "Konversationer" : "Conversations"}
          </dt>
          <dd className="mt-1 text-sm text-on-surface">
            {formatAdminNumber(workspace.conversationCount, language)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        {pills.map((pill) => (
          <div
            key={pill.label}
            className="flex-1 rounded-2xl bg-surface-container-low px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
              {pill.label}
            </p>
            <p className="mt-1 text-lg font-medium tracking-tight text-on-surface">
              {formatAdminNumber(pill.value, language)}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
