'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useModals } from '@/components/ui/ModalProvider';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { EntityActionsMenu } from '@/components/ui/EntityActionsMenu';
import { useToast } from '@/components/ui/ToastProvider';
import { useAppContext } from '@/components/app/AppContext';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import type { AgentRecord } from '@/lib/types';

export default function AgentsPage() {
  const supabase = createClient();
  const { workspace, user, membership } = useAppContext();
  const { openCreateAgent } = useModals();
  const { showToast } = useToast();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentRecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  /** Client-side pagination state */
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  /** Returns a human-readable status label for display purposes */
  const getAgentStateLabel = (agent: AgentRecord) => {
    if (agent.archived_at) return 'Archived';
    if (agent.status === 'active' && agent.published_version_id) return 'Live';
    if (agent.status === 'paused') return 'Off';
    return 'Draft';
  };

  /** Returns the Tailwind colour class for the left-side status indicator dot */
  const getDotColor = (agent: AgentRecord) => {
    if (agent.archived_at) return 'bg-[#94A3B8]';
    if (agent.status === 'active' && agent.published_version_id) return 'bg-emerald-500';
    if (agent.status === 'active') return 'bg-amber-400';
    return 'bg-[#CBD5E1]';
  };

  /** Returns a colour-coded badge label and CSS class string for the agent's model pill */
  const getModelBadge = (model: string | null | undefined) => {
    const m = (model ?? '').toLowerCase();
    if (m.includes('claude'))
      return { label: model ?? 'Claude', cls: 'border-teal-300 text-teal-700 bg-teal-50' };
    if (m.includes('gpt-4o mini') || m.includes('gpt-4o-mini'))
      return { label: model ?? 'GPT-4o Mini', cls: 'border-violet-300 text-violet-700 bg-violet-50' };
    if (m.includes('gpt-4o'))
      return { label: model ?? 'GPT-4o', cls: 'border-[#FF6B52]/40 text-[#FF6B52] bg-[#FFF0ED]' };
    if (m.includes('gpt-3'))
      return { label: model ?? 'GPT-3.5', cls: 'border-slate-300 text-slate-500 bg-slate-50' };
    return { label: model ?? '—', cls: 'border-slate-200 text-slate-500 bg-slate-50' };
  };

  /** Loads all agents for the current workspace from Supabase on mount */
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        if (isMounted) setAgents((data ?? []) as AgentRecord[]);
      } catch (error) {
        if (isMounted) {
          showToast(error instanceof Error ? error.message : 'Failed to load agents.', 'error');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, [showToast, supabase, workspace.id]);

  /** Filters agents by tab selection and search query */
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const isArchived = Boolean(agent.archived_at);
      const matchesQuery =
        query.length === 0 ||
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.description.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === 'all' ||
        (filter === 'archived'
          ? isArchived
          : filter === 'active'
            ? agent.status === 'active' && !isArchived
            : agent.status === 'draft' && !isArchived);
      return matchesQuery && matchesFilter;
    });
  }, [agents, filter, query]);

  /** Reset pagination to page 1 whenever the filter or search query changes */
  useEffect(() => { setCurrentPage(1); }, [filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedAgents = filteredAgents.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  /** Toggles the agent's archived state via the archive API route */
  const handleArchiveToggle = async (agent: AgentRecord) => {
    setPendingAgentId(agent.id);
    try {
      const response = await fetch(`/api/agents/${agent.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !agent.archived_at }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to update archive status.');
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
      showToast(agent.archived_at ? 'Agent restored.' : 'Agent archived.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update archive status.', 'error');
    } finally {
      setPendingAgentId(null);
    }
  };

  /** Toggles an agent between active and paused via the status API route */
  const handleStatusToggle = async (agent: AgentRecord) => {
    if (agent.archived_at) {
      showToast('Restore the agent before changing its status.', 'error');
      return;
    }
    const nextStatus = agent.status === 'active' ? 'paused' : 'active';
    setTogglingAgentId(agent.id);
    try {
      const response = await fetch(`/api/agents/${agent.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to update agent status.');
      setAgents((current) =>
        current.map((item) => item.id === agent.id ? { ...item, status: nextStatus } : item),
      );
      showToast(nextStatus === 'active' ? 'Agent turned on.' : 'Agent turned off.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update agent status.', 'error');
    } finally {
      setTogglingAgentId(null);
    }
  };

  /** Opens the permanent-delete confirmation modal (owner-only, requires archived state) */
  const handlePermanentDelete = async (agent: AgentRecord) => {
    if (membership.role !== 'owner') {
      showToast('Only workspace owners can permanently delete an agent.', 'error');
      return;
    }
    if (!agent.archived_at) {
      showToast('Archive the agent first before permanently deleting it.', 'error');
      return;
    }
    setAgentToDelete(agent);
    setDeleteConfirmation('');
  };

  const closeDeleteModal = () => {
    if (deletingAgentId) return;
    setAgentToDelete(null);
    setDeleteConfirmation('');
  };

  /** Calls the DELETE /api/agents/[id] endpoint to permanently remove an agent */
  const confirmPermanentDelete = async () => {
    if (!agentToDelete) return;
    setDeletingAgentId(agentToDelete.id);
    try {
      const response = await fetch(`/api/agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName: deleteConfirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Failed to delete agent.');
      setAgents((current) => current.filter((item) => item.id !== agentToDelete.id));
      setAgentToDelete(null);
      setDeleteConfirmation('');
      showToast('Agent permanently deleted.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete agent.', 'error');
    } finally {
      setDeletingAgentId(null);
    }
  };

  /* ─── Render ──────────────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Specialist library
          </p>
          <h1 className="mt-3 text-[2.15rem] font-headline font-bold tracking-tight text-on-surface sm:text-[2.45rem]">
            Agents
          </h1>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            Build, publish, and maintain the specialists your widgets depend on.
          </p>
        </div>
        <button
          onClick={openCreateAgent}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          Create Agent
        </button>
      </div>

      {/* ── Table card ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">

        {/* Filter bar — tabs left, search right */}
        <div className="flex flex-col gap-3 border-b border-outline-variant/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'active', 'draft', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filter === tab
                    ? 'bg-on-surface text-background'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="w-full rounded-xl border border-outline-variant/20 bg-background px-4 py-2 text-sm outline-none placeholder:text-on-surface-variant/50 sm:max-w-xs"
          />
        </div>

        {/* Column header row — visible on medium+ screens */}
        <div className="hidden border-b border-outline-variant/15 bg-surface-container-low/60 md:grid md:grid-cols-[2.5rem_1fr_10rem_8rem_9rem_7rem] md:items-center md:gap-4 md:px-5 md:py-2.5">
          <div />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Agent</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Model</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Prompts</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Last Update</span>
          <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Status</span>
        </div>

        {/* Body */}
        {isLoading ? (
          /* Loading skeleton */
          <div className="divide-y divide-outline-variant/10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mx-5 my-3 h-[68px] animate-pulse rounded-xl bg-surface-container-low/40" />
            ))}
          </div>
        ) : pagedAgents.length === 0 ? (
          /* Empty state */
          <div className="px-6 py-20 text-center">
            <span className="material-symbols-outlined rounded-full bg-primary/5 p-4 text-3xl text-primary">hub</span>
            <h2 className="mt-4 font-headline text-2xl font-bold text-on-surface">No matching agents</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
              Create an agent or clear the current filters.
            </p>
          </div>
        ) : (
          /* Agent rows */
          <div className="divide-y divide-outline-variant/10">
            {pagedAgents.map((agent) => {
              const isActive = agent.status === 'active' && !agent.archived_at;
              const isBusy = togglingAgentId === agent.id || pendingAgentId === agent.id || deletingAgentId === agent.id;
              const toggleDisabled = Boolean(agent.archived_at) || isBusy || (agent.status !== 'active' && !agent.published_version_id);
              const { label: modelLabel, cls: modelCls } = getModelBadge(agent.model);
              const promptCount = agent.starter_prompts?.length ?? 0;

              return (
                <div
                  key={agent.id}
                  className="group relative flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low/50 md:grid md:grid-cols-[2.5rem_1fr_10rem_8rem_9rem_7rem] md:items-center md:gap-4"
                >
                  {/* 1. Status dot */}
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getDotColor(agent)}`} />

                  {/* 2. Agent name + description */}
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-on-surface">{agent.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-on-surface-variant">
                      {agent.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* 3. Model badge pill */}
                  <div>
                    <span className={`inline-block rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-wide ${modelCls}`}>
                      {modelLabel}
                    </span>
                  </div>

                  {/* 4. Prompt count */}
                  <span className="text-[12px] font-semibold text-on-surface-variant">
                    {promptCount} {promptCount === 1 ? 'Prompt' : 'Prompts'}
                  </span>

                  {/* 5. Last updated */}
                  <div>
                    <p className="text-[12px] font-semibold text-on-surface-variant">
                      {formatRelativeDate(agent.updated_at)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant/60">by System</p>
                  </div>

                  {/* 6. Toggle + hover row actions */}
                  <div className="flex items-center justify-end gap-3">
                    {/* iOS-style status toggle */}
                    <button
                      onClick={() => void handleStatusToggle(agent)}
                      disabled={toggleDisabled}
                      aria-label={isActive ? 'Turn agent off' : 'Turn agent on'}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
                        isActive ? 'bg-[#FF6B52]' : 'bg-outline-variant/40'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                          isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    {/* Row actions — fade in on row hover */}
                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/agents/${agent.id}/builder`}
                        className="text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
                      >
                        Builder
                      </Link>
                      <Link
                        href={`/agents/${agent.id}/preview`}
                        className="flex h-7 items-center justify-center rounded-lg bg-on-surface px-3 text-[11px] font-bold text-background hover:opacity-80"
                      >
                        Preview
                      </Link>
                      <EntityActionsMenu
                        onArchiveToggle={() => void handleArchiveToggle(agent)}
                        archiveLabel={agent.archived_at ? 'Restore' : 'Archive'}
                        archiveDisabled={isBusy}
                        onDelete={() => void handlePermanentDelete(agent)}
                        deleteDisabled={isBusy || !agent.archived_at || membership.role !== 'owner'}
                        buttonClassName="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                        iconClassName="material-symbols-outlined text-[16px]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table footer — showing count and pagination */}
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/15 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
            Showing{' '}
            {filteredAgents.length === 0
              ? '0'
              : `${(safePage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(safePage * ITEMS_PER_PAGE, filteredAgents.length)}`}{' '}
            of {filteredAgents.length} Agent{filteredAgents.length !== 1 ? 's' : ''}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
                aria-label="Previous page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    page === safePage
                      ? 'bg-on-surface text-background'
                      : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
                aria-label="Next page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Permanent delete confirmation modal — logic unchanged */}
      <ConfirmDeleteModal
        isOpen={Boolean(agentToDelete)}
        title="Delete Agent"
        entityName={agentToDelete?.name ?? ''}
        entityLabel="Agent"
        description="This permanently removes the agent, including its drafts, versions, widget assignments, chats, and runs."
        confirmationValue={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onClose={closeDeleteModal}
        onConfirm={() => void confirmPermanentDelete()}
        isDeleting={deletingAgentId === agentToDelete?.id}
      />
    </div>
  );
}
