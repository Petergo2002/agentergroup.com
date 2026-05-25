import type { AdminWorkspaceAgentRow } from "@/lib/admin/types";
import {
  formatAdminNumber,
} from "@/lib/admin/format";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminAgentsTableProps {
  agents: AdminWorkspaceAgentRow[];
  language: PlatformLanguage;
}

export function AdminAgentsTable({ agents, language }: AdminAgentsTableProps) {
  if (agents.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-outline bg-surface shadow-tactile">
        <AdminEmptyState
          title={language === "sv" ? "Inga agenter i detta workspace" : "No agents in this workspace"}
          description={
            language === "sv"
              ? "Agentposter och deras användning visas här när kunden börjar skapa dem."
              : "Agent records and their usage totals will appear here once this customer creates them."
          }
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-outline bg-surface shadow-tactile">
      <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 border-b border-outline bg-surface-container-low px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
        <span>{language === "sv" ? "Agent" : "Agent"}</span>
        <span>{language === "sv" ? "Skapad" : "Created"}</span>
        <span>{language === "sv" ? "Konversationer" : "Conversations"}</span>
        <span>{language === "sv" ? "Meddelanden" : "Messages"}</span>
        <span>{language === "sv" ? "Senast aktiv" : "Last active"}</span>
      </div>
      <div className="divide-y divide-outline">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 px-6 py-4 text-sm text-on-surface"
          >
            <span className="font-medium text-on-surface">{agent.name}</span>
            <AdminTimestamp value={agent.createdAt} className="text-on-surface-variant" language={language} />
            <span>{formatAdminNumber(agent.conversationCount, language)}</span>
            <span>{formatAdminNumber(agent.messageCount, language)}</span>
            <AdminTimestamp value={agent.lastActiveAt} className="text-on-surface-variant" language={language} />
          </div>
        ))}
      </div>
    </section>
  );
}
