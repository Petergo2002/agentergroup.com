'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useModals } from '@/components/ui/ModalProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { useAppContext } from '@/components/app/AppContext';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import type { AgentRecord } from '@/lib/types';

export default function AgentsPage() {
  const supabase = createClient();
  const { workspace, user } = useAppContext();
  const { openCreateAgent } = useModals();
  const { showToast } = useToast();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

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
                status: agent.archived_at ? item.status : 'paused',
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
                className="grid items-center gap-6 px-8 py-7 transition-colors hover:bg-surface-container-low/45 lg:grid-cols-[1.1fr_0.85fr_0.35fr_0.45fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-on-surface">{agent.name}</p>
                  <p className="mt-1.5 max-w-sm line-clamp-2 text-sm leading-6 text-on-surface-variant">
                    {agent.description || 'Architecting intelligence, one prompt at a time.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <div className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-background px-3.5 py-1.5">
                    <span className="material-symbols-outlined text-base text-on-surface-variant/55">
                      psychology
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/85">
                      {agent.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-background px-3.5 py-1.5">
                    <span className="material-symbols-outlined text-base text-on-surface-variant/55">
                      chat_bubble
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/85">
                      {agent.starter_prompts.length} Prompts
                    </span>
                  </div>
                </div>

                <div className="flex justify-start">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                    agent.archived_at 
                      ? 'bg-surface-container text-on-surface-variant opacity-60' 
                      : agent.status === 'active'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/10'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      agent.archived_at ? 'bg-on-surface-variant' : agent.status === 'active' ? 'bg-primary animate-pulse' : 'bg-on-surface-variant/40'
                    }`} />
                    {agent.archived_at ? 'archived' : agent.status}
                  </span>
                </div>

                <div className="flex items-center text-xs font-medium text-on-surface-variant/60 whitespace-nowrap">
                  Updated {formatRelativeDate(agent.updated_at)}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/agents/${agent.id}/builder`}
                    className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-background px-4 py-2.5 text-xs font-semibold text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-on-surface hover:border-outline-variant/40 active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-sm">construction</span>
                    Builder
                  </Link>
                  <Link
                    href={`/agents/${agent.id}/preview`}
                    className="flex items-center gap-2 rounded-full bg-on-surface px-4 py-2.5 text-xs font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Preview
                  </Link>
                  <button
                    onClick={() => void handleArchiveToggle(agent)}
                    disabled={pendingAgentId === agent.id}
                    title={agent.archived_at ? 'Restore Agent' : 'Archive Agent'}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/15 text-on-surface-variant/60 transition-all hover:bg-error/5 hover:text-error hover:border-error/20 active:scale-[0.95] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {pendingAgentId === agent.id ? 'sync' : agent.archived_at ? 'unarchive' : 'archive'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
