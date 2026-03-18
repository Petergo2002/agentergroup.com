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

  const getAgentStateLabel = (agent: AgentRecord) => {
    if (agent.archived_at) {
      return 'Archived';
    }

    if (agent.status === 'active' && agent.published_version_id) {
      return 'Live';
    }

    if (agent.status === 'paused') {
      return 'Off';
    }

    return 'Draft';
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (isMounted) {
          setAgents((data ?? []) as AgentRecord[]);
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Failed to load agents.';
          showToast(message, 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [showToast, supabase, workspace.id]);

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

  const handleArchiveToggle = async (agent: AgentRecord) => {
    setPendingAgentId(agent.id);

    try {
      const response = await fetch(`/api/agents/${agent.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archived: !agent.archived_at,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update archive status.');
      }

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
      const message =
        error instanceof Error ? error.message : 'Failed to update archive status.';
      showToast(message, 'error');
    } finally {
      setPendingAgentId(null);
    }
  };

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update agent status.');
      }

      setAgents((current) =>
        current.map((item) =>
          item.id === agent.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item,
        ),
      );
      showToast(nextStatus === 'active' ? 'Agent turned on.' : 'Agent turned off.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to update agent status.',
        'error',
      );
    } finally {
      setTogglingAgentId(null);
    }
  };

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
    if (deletingAgentId) {
      return;
    }

    setAgentToDelete(null);
    setDeleteConfirmation('');
  };

  const confirmPermanentDelete = async () => {
    if (!agentToDelete) {
      return;
    }

    setDeletingAgentId(agentToDelete.id);

    try {
      const response = await fetch(`/api/agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationName: deleteConfirmation,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete agent.');
      }

      setAgents((current) => current.filter((item) => item.id !== agentToDelete.id));
      setAgentToDelete(null);
      setDeleteConfirmation('');
      showToast('Agent permanently deleted.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete agent.';
      showToast(message, 'error');
    } finally {
      setDeletingAgentId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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

      <div className="mb-6 flex flex-col gap-4 rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['draft', 'Draft'],
            ['archived', 'Archived'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as 'all' | 'active' | 'draft' | 'archived')}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                filter === value
                  ? 'bg-on-surface text-background'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
          className="w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm outline-none md:max-w-xs"
        />
      </div>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[1.7rem] bg-surface-container-low" />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-[1.8rem] bg-white px-6 py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="material-symbols-outlined rounded-full bg-primary/5 p-4 text-3xl text-primary">
              hub
            </span>
            <h2 className="mt-4 font-headline text-2xl font-bold text-on-surface">
              No matching agents
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
              Create an agent or clear the current filters. Every saved draft now persists
              in Supabase and opens in the dedicated builder route.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-5 rounded-[1.7rem] border border-transparent bg-white px-6 py-5 shadow-[0_2px_10px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] md:flex-row md:items-center md:justify-between"
              >
                {/* Left: Name and Description */}
                <div className="min-w-0 flex-1 md:max-w-[30%]">
                  <p className="truncate text-[15px] font-bold text-[#1E293B]">{agent.name}</p>
                  <p className="mt-1 truncate text-sm text-[#94A3B8]">
                    {agent.description || 'Architecting intelligence, one prompt at a time.'}
                  </p>
                </div>

                {/* Middle: Badges */}
                <div className="flex flex-col items-center gap-2 md:flex-1 md:justify-center">
                  <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
                    <div className="flex h-8 items-center gap-1.5 rounded-[0.6rem] bg-[#F1F5F9] px-3.5 text-[#64748B]">
                      <span className="material-symbols-outlined text-[15px]">
                        psychology
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {agent.model}
                      </span>
                    </div>
                    
                    <div className="flex h-8 items-center gap-1.5 rounded-[0.6rem] bg-[#F1F5F9] px-3.5 text-[#64748B]">
                      <span className="material-symbols-outlined text-[14px]">
                        chat_bubble
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {agent.starter_prompts.length} Prompts
                      </span>
                    </div>
                  </div>

                  <div className="flex h-7 items-center gap-1.5 rounded-full bg-[#FFF0ED] px-3 text-[#FF6B52]">
                    <span className={`h-1.5 w-1.5 rounded-full ${agent.archived_at ? 'bg-on-surface-variant' : agent.status === 'active' ? 'bg-[#FF6B52] animate-pulse' : 'bg-[#FF6B52]/40'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      {getAgentStateLabel(agent)}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 md:flex-1">
                  <div className="mr-2 text-xs font-medium text-[#94A3B8]">
                    Updated {formatRelativeDate(agent.updated_at)}
                  </div>
                  
                  {/* Custom Toggle matching screenshot */}
                  <button
                    onClick={() => void handleStatusToggle(agent)}
                    disabled={
                      Boolean(agent.archived_at) ||
                      togglingAgentId === agent.id ||
                      pendingAgentId === agent.id ||
                      deletingAgentId === agent.id ||
                      (agent.status !== 'active' && !agent.published_version_id)
                    }
                    className="flex h-8 items-center rounded-full bg-[#FFF0ED] p-0.5 text-[10px] font-bold tracking-wider transition-opacity disabled:opacity-50"
                  >
                    <span className={`flex h-full items-center justify-center rounded-full px-3 ${agent.status !== 'active' ? 'text-[#FF6B52]/60' : 'text-[#FF6B52]/60'}`}>
                      OFF
                    </span>
                    <span className={`flex h-full items-center justify-center rounded-full px-3 transition-colors ${agent.status === 'active' && !agent.archived_at ? 'bg-[#FF6B52] text-white shadow-sm' : 'text-[#FF6B52]/60'}`}>
                      ON
                    </span>
                  </button>

                  <Link
                    href={`/agents/${agent.id}/builder`}
                    className="px-2 py-2 text-xs font-bold text-[#64748B] transition-colors hover:text-[#1E293B]"
                  >
                    Builder
                  </Link>
                  
                  <Link
                    href={`/agents/${agent.id}/preview`}
                    className="flex h-8 items-center justify-center rounded-lg bg-[#0F1728] px-4 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Preview
                  </Link>

                  <EntityActionsMenu
                    onArchiveToggle={() => void handleArchiveToggle(agent)}
                    archiveLabel={agent.archived_at ? 'Restore' : 'Archive'}
                    archiveDisabled={
                      pendingAgentId === agent.id ||
                      deletingAgentId === agent.id ||
                      togglingAgentId === agent.id
                    }
                    onDelete={() => void handlePermanentDelete(agent)}
                    deleteDisabled={
                      deletingAgentId === agent.id ||
                      pendingAgentId === agent.id ||
                      togglingAgentId === agent.id ||
                      !agent.archived_at ||
                      membership.role !== 'owner'
                    }
                    buttonClassName="flex h-8 w-10 items-center justify-center rounded-lg border-[1.5px] border-[#2563EB] text-[#2563EB] transition-colors hover:bg-[#2563EB]/5 bg-white ml-2"
                    iconClassName="material-symbols-outlined text-[18px]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
