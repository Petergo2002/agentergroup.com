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
      <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
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
    <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
      <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-neutral-500">
        <span>{language === "sv" ? "Agent" : "Agent"}</span>
        <span>{language === "sv" ? "Skapad" : "Created"}</span>
        <span>{language === "sv" ? "Konversationer" : "Conversations"}</span>
        <span>{language === "sv" ? "Meddelanden" : "Messages"}</span>
        <span>{language === "sv" ? "Senast aktiv" : "Last active"}</span>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 px-6 py-4 text-sm text-neutral-200"
          >
            <span className="font-medium text-white">{agent.name}</span>
            <AdminTimestamp value={agent.createdAt} className="text-neutral-300" language={language} />
            <span>{formatAdminNumber(agent.conversationCount, language)}</span>
            <span>{formatAdminNumber(agent.messageCount, language)}</span>
            <AdminTimestamp value={agent.lastActiveAt} className="text-neutral-300" language={language} />
          </div>
        ))}
      </div>
    </section>
  );
}
