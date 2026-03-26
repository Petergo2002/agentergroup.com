import type { AdminWorkspaceAgentRow } from "@/lib/admin/types";
import {
  formatAdminNumber,
} from "@/lib/admin/format";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminTimestamp } from "@/components/admin/AdminTimestamp";

interface AdminAgentsTableProps {
  agents: AdminWorkspaceAgentRow[];
}

export function AdminAgentsTable({ agents }: AdminAgentsTableProps) {
  if (agents.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
        <AdminEmptyState
          title="No agents in this workspace"
          description="Agent records and their usage totals will appear here once this customer creates them."
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#222] bg-[#171717]">
      <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 px-6 py-4 text-[12px] uppercase tracking-[0.14em] text-neutral-500">
        <span>Agent</span>
        <span>Created</span>
        <span>Conversations</span>
        <span>Messages</span>
        <span>Last active</span>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-4 px-6 py-4 text-sm text-neutral-200"
          >
            <span className="font-medium text-white">{agent.name}</span>
            <AdminTimestamp value={agent.createdAt} className="text-neutral-300" />
            <span>{formatAdminNumber(agent.conversationCount)}</span>
            <span>{formatAdminNumber(agent.messageCount)}</span>
            <AdminTimestamp value={agent.lastActiveAt} className="text-neutral-300" />
          </div>
        ))}
      </div>
    </section>
  );
}
