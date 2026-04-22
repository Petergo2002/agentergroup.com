"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Filter, Activity } from "lucide-react";
import { AppIcon } from "@/components/icons/AppIcon";
import { canEditAgentRecord } from "@/lib/agents/access";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useModals } from "@/components/ui/ModalProvider";
import { ConfirmDeleteModal } from "@/components/modals/ConfirmDeleteModal";
import { useToast } from "@/components/ui/ToastProvider";
import { useAppContext } from "@/components/app/AppContext";
import { AgentCard } from "@/components/agents/AgentCard";
import type { AgentRecord } from "@/lib/types";

export default function AgentsPageClient({
  initialAgents,
}: {
  initialAgents: AgentRecord[];
}) {
  const { user, membership } = useAppContext();
  const { t } = useLanguage();
  const { openCreateAgent } = useModals();
  const { showToast } = useToast();
  const [agents, setAgents] = useState<AgentRecord[]>(initialAgents);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const isLoading = false;

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const isArchived = Boolean(agent.archived_at);
      const matchesQuery =
        query.length === 0 ||
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.description.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "archived"
          ? isArchived
          : filter === "active"
            ? agent.status === "active" && !isArchived
            : agent.status === "draft" && !isArchived);
      return matchesQuery && matchesFilter;
    });
  }, [agents, filter, query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedAgents = filteredAgents.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const handleArchiveToggle = async (agent: AgentRecord) => {
    setPendingAgentId(agent.id);
    try {
      const response = await fetch(`/api/agents/${agent.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !agent.archived_at }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update archive status.");
      setAgents((current) =>
        current.map((item) =>
          item.id === agent.id
            ? {
                ...item,
                archived_at: agent.archived_at ? null : new Date().toISOString(),
                archived_by: agent.archived_at ? null : user.id,
              }
            : item,
        ),
      );
      showToast(agent.archived_at ? t("agents.restored") : t("agents.archived"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("agents.updateArchiveError"), "error");
    } finally {
      setPendingAgentId(null);
    }
  };

  const handleStatusToggle = async (agent: AgentRecord) => {
    if (agent.archived_at) {
      showToast(t("agents.restoreBeforeStatus"), "error");
      return;
    }
    const nextStatus = agent.status === "active" ? "paused" : "active";
    setTogglingAgentId(agent.id);
    try {
      const response = await fetch(`/api/agents/${agent.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t("agents.updateStatusError"));
      setAgents((current) =>
        current.map((item) => item.id === agent.id ? { ...item, status: nextStatus } : item),
      );
      showToast(nextStatus === "active" ? t("agents.turnedOn") : t("agents.turnedOff"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("agents.updateStatusError"), "error");
    } finally {
      setTogglingAgentId(null);
    }
  };

  const handlePermanentDelete = async (agent: AgentRecord) => {
    if (membership.role !== "owner") {
      showToast(t("agents.ownerDeleteOnly"), "error");
      return;
    }
    if (!agent.archived_at) {
      showToast(t("agents.archiveBeforeDelete"), "error");
      return;
    }
    setAgentToDelete(agent);
    setDeleteConfirmation("");
  };

  const confirmPermanentDelete = async () => {
    if (!agentToDelete) return;
    setDeletingAgentId(agentToDelete.id);
    try {
      const response = await fetch(`/api/agents/${agentToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName: deleteConfirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("agents.deleteError"));
      setAgents((current) => current.filter((item) => item.id !== agentToDelete.id));
      setAgentToDelete(null);
      setDeleteConfirmation("");
      showToast(t("agents.deleted"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("agents.deleteError"), "error");
    } finally {
      setDeletingAgentId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-12 lg:px-12 space-y-12 animate-in fade-in duration-1000">
      
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-8">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/5 text-primary mb-5">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t('agents.agentLibrary')}</span>
          </div>
          <h1 className="font-headline text-[2.75rem] font-bold leading-[1.05] text-on-surface tracking-tight">
            {t('agents.headline')}
          </h1>
          <p className="mt-5 text-[14px] font-medium leading-relaxed text-on-surface-variant/70 max-w-md">
            {t('agents.description')}
          </p>
        </div>

        <button
          onClick={() => openCreateAgent()}
          className="signature-gradient group relative flex h-14 items-center justify-between rounded-full pl-6 pr-2 text-sm font-bold shadow-xl shadow-black/25 transition-all hover:border-primary/25 hover:bg-primary/8 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5" />
            <span className="uppercase tracking-[0.15em] pr-4">{t('agents.createAgent')}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-on-surface/5 backdrop-blur-sm transition-colors group-hover:bg-primary/12">
            <AppIcon name="arrow_forward" className="h-4 w-4" />
          </div>
        </button>
      </header>

      {/* ─── Filters & Search ──────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-2 rounded-[2.25rem] bg-surface-container-low ring-1 ring-outline-variant/15 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-1.5 p-1 w-full md:w-auto">
          {(["all", "active", "draft", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 md:flex-none rounded-md px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-150 active:scale-[0.98] ${
                filter === tab
                  ? "bg-on-surface text-background shadow-lg shadow-on-surface/20"
                  : "text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high/50"
              }`}
            >
              {t(`agents.filters.${tab}`)}
            </button>
          ))}
        </div>

        <div className="relative w-full md:max-w-xs pr-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agents.searchPlaceholder')}
            className="w-full bg-surface-container-high/30 border border-outline-variant/30 rounded-md py-3 pl-11 pr-4 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/40 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all outline-none shadow-sm"
          />
        </div>
      </div>

      {/* ─── Grid ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[240px] animate-pulse rounded-[2rem] bg-surface-container-low/40" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center rounded-[3rem] bg-surface-container-low/10">
          <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
            <Filter className="h-8 w-8 text-primary/30" />
          </div>
          <h2 className="text-2xl font-headline font-bold text-on-surface">{t('agents.noAgentsFound')}</h2>
          <p className="mt-3 text-[14px] text-on-surface-variant/60 max-w-sm">
            {t('agents.noAgentsFoundDescription')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isActive={agent.status === 'active' && !agent.archived_at}
              isBusy={togglingAgentId === agent.id || pendingAgentId === agent.id || deletingAgentId === agent.id}
              canEdit={canEditAgentRecord(agent, user.id, membership.role)}
              membershipRole={membership.role}
              onStatusToggle={handleStatusToggle}
              onArchiveToggle={handleArchiveToggle}
              onPermanentDelete={handlePermanentDelete}
            />
          ))}
        </div>
      )}

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between pt-8 border-t border-outline-variant/10">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
          {t("agents.showingSummary", {
            shown: pagedAgents.length,
            total: filteredAgents.length,
          })}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`h-9 w-9 rounded-md flex items-center justify-center text-[12px] font-bold transition-all duration-150 active:scale-[0.98] ${
                  page === safePage
                    ? "bg-on-surface text-background shadow-md shadow-on-surface/10"
                    : "text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </footer>

      {/* ─── Modals ────────────────────────────────────────────── */}
      <ConfirmDeleteModal
        isOpen={Boolean(agentToDelete)}
        title={t("agents.deleteTitle")}
        entityName={agentToDelete?.name ?? ""}
        entityLabel={t("agents.deleteEntityLabel")}
        description={t("agents.deleteDescription")}
        confirmationValue={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onClose={() => setAgentToDelete(null)}
        onConfirm={() => void confirmPermanentDelete()}
        isDeleting={deletingAgentId === agentToDelete?.id}
      />
    </div>
  );
}
