'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useModals } from '@/components/ui/ModalProvider';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import { EntityActionsMenu } from '@/components/ui/EntityActionsMenu';
import { StatusToggle } from '@/components/ui/StatusToggle';
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

  const getAgentStateClasses = (agent: AgentRecord) => {
    if (agent.archived_at) {
      return 'bg-surface-container text-on-surface-variant opacity-70';
    }

    if (agent.status === 'active' && agent.published_version_id) {
      return 'bg-primary/10 text-primary';
    }

    if (agent.status === 'paused') {
      return 'bg-surface-container-high text-on-surface-variant';
    }

    return 'bg-background text-on-surface-variant ring-1 ring-outline-variant/10';
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

      <div className="overflow-hidden rounded-[1.8rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-surface-container-low" />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="px-6 py-16 text-center">
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
          <div className="divide-y divide-outline-variant/10">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="px-8 py-7 transition-colors hover:bg-surface-container-low/45"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-4 xl:flex-row xl:items-center xl:gap-8">
                    <div className="min-w-0 xl:min-w-[260px] xl:flex-[1.1]">
                      <p className="truncate text-base font-semibold text-on-surface">{agent.name}</p>
                      <p className="mt-1.5 max-w-xl line-clamp-2 text-sm leading-6 text-on-surface-variant">
                        {agent.description || 'Architecting intelligence, one prompt at a time.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 xl:flex-[0.9]">
                      <div className="flex items-center gap-2 rounded-full bg-background px-3.5 py-1.5 ring-1 ring-outline-variant/10">
                        <span className="material-symbols-outlined text-base text-on-surface-variant/55">
                          psychology
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/85">
                          {agent.model}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-background px-3.5 py-1.5 ring-1 ring-outline-variant/10">
                        <span className="material-symbols-outlined text-base text-on-surface-variant/55">
                          chat_bubble
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/85">
                          {agent.starter_prompts.length} Prompts
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${getAgentStateClasses(agent)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          agent.archived_at
                            ? 'bg-on-surface-variant'
                            : agent.status === 'active'
                              ? 'bg-primary animate-pulse'
                              : 'bg-on-surface-variant/40'
                        }`} />
                        {getAgentStateLabel(agent)}
                      </span>
                      {!agent.published_version_id && !agent.archived_at ? (
                        <span className="text-[11px] font-medium text-on-surface-variant">
                          Publish first to turn on
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 xl:gap-3">
                    <div className="text-xs font-medium text-on-surface-variant/60">
                      Updated {formatRelativeDate(agent.updated_at)}
                    </div>
                    <StatusToggle
                      checked={agent.status === 'active' && !agent.archived_at}
                      onClick={() => void handleStatusToggle(agent)}
                      disabled={
                        Boolean(agent.archived_at) ||
                        togglingAgentId === agent.id ||
                        pendingAgentId === agent.id ||
                        deletingAgentId === agent.id ||
                        (agent.status !== 'active' && !agent.published_version_id)
                      }
                      label={`Toggle ${agent.name}`}
                      activeLabel="On"
                      inactiveLabel="Off"
                    />
                    <Link
                      href={`/agents/${agent.id}/builder`}
                      className="rounded-full px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                    >
                      Builder
                    </Link>
                    <Link
                      href={`/agents/${agent.id}/preview`}
                      className="rounded-full bg-on-surface px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
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
                    />
                  </div>
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
