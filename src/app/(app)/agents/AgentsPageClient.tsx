"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Filter, Activity, Library } from "lucide-react";
import { canEditAgentRecord } from "@/lib/agents/access";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useModals } from "@/components/ui/ModalProvider";
import { ConfirmDeleteModal } from "@/components/modals/ConfirmDeleteModal";
import { AgentLibraryDialog } from "@/components/agents/AgentLibraryDialog";
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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
    <div className="app-page app-page-compact">
      <header className="app-section-header overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="app-kicker">
              <Activity className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-xs font-semibold leading-5">{t('agents.agentLibrary')}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
              {t('agents.headline')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {t('agents.description')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="app-secondary-button min-w-32"
            >
              <Library className="h-[18px] w-[18px] text-primary" />
              {t('agents.library')}
            </button>

            <button
              type="button"
              onClick={() => openCreateAgent()}
              className="app-primary-button min-w-36"
            >
              <Plus className="h-[18px] w-[18px]" />
              {t('agents.createAgent')}
            </button>
          </div>
        </div>
      </header>

      <section className="app-filter-panel flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-low p-1 md:w-auto">
          {(["all", "active", "draft", "archived"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`h-9 flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all md:flex-none ${
                filter === tab
                  ? "bg-primary text-on-primary shadow-[0_10px_22px_-18px_rgba(var(--primary-rgb),0.72)]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              {t(`agents.filters.${tab}`)}
            </button>
          ))}
        </div>

        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agents.searchPlaceholder')}
            className="depth-input h-11 w-full rounded-xl border bg-surface-container-low pl-11 pr-4 text-sm font-medium text-on-surface outline-none placeholder:text-on-surface-variant/45 focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </section>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="app-empty-state">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant ring-1 ring-outline/70">
            <Filter className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold tracking-normal text-on-surface">{t('agents.noAgentsFound')}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-on-surface-variant/70">
            {t('agents.noAgentsFoundDescription')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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

      <footer className="flex flex-col gap-4 border-t border-outline-variant/10 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-on-surface-variant/70">
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
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  page === safePage
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </footer>

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

      <AgentLibraryDialog
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
      />
    </div>
  );
}
