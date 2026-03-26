'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { useToast } from '@/components/ui/ToastProvider';
import { getEffectiveConnectionStatus } from '@/lib/connections';
import { extractEndChatPolicyFromDefinition } from '@/lib/end-chat';
import { isChatIntegrationSlug } from '@/lib/integrations';
import { getKnowledgeStatusTone } from '@/lib/knowledge';
import type {
  AgentRecord,
  ConnectionRecord,
  EndChatPolicy,
  KnowledgeMatchRecord,
  KnowledgeSourceRecord,
  MessageRecord,
  RunApprovalRecord,
  RunRecord,
  RunStepRecord,
  ThreadRecord,
} from '@/lib/types';
import { formatRelativeDate } from '@/lib/utils';

interface AgentConnectionJoinRow {
  connection: ConnectionRecord | ConnectionRecord[] | null;
}

interface AgentKnowledgeJoinRow {
  source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
}

function getKnowledgeMatches(message: MessageRecord) {
  const value = message.metadata?.knowledgeMatches;

  if (!Array.isArray(value)) {
    return [];
  }

  return value as KnowledgeMatchRecord[];
}

export default function AgentPreviewPage() {
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const { workspace, user } = useAppContext();
  const { showToast } = useToast();
  const agentId = params.id;
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceRecord[]>([]);
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStepRecord[]>([]);
  const [runApprovals, setRunApprovals] = useState<RunApprovalRecord[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [completedThreadIds, setCompletedThreadIds] = useState<string[]>([]);
  const [endChatPolicy, setEndChatPolicy] = useState<EndChatPolicy>({
    enabled: false,
    inactivityTimeoutSeconds: null,
    allowAssistantSuggestion: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const visibleMessages = messages.filter((message) => message.role !== 'tool');
  const isActiveThreadCompleted = activeThreadId
    ? completedThreadIds.includes(activeThreadId)
    : false;
  const [previewInactivityTimerId, setPreviewInactivityTimerId] = useState<number | null>(null);

  const clearPreviewInactivityTimer = useCallback(() => {
    if (previewInactivityTimerId !== null) {
      window.clearTimeout(previewInactivityTimerId);
      setPreviewInactivityTimerId(null);
    }
  }, [previewInactivityTimerId]);

  const loadMessages = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    setMessages((data ?? []) as MessageRecord[]);
  }, [supabase]);

  const createThread = useCallback(async (title?: string) => {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        workspace_id: workspace.id,
        agent_id: agentId,
        created_by: user.id,
        title: title ?? 'New chat',
      })
      .select()
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create thread.');
    }

    setThreads((current) => [data as ThreadRecord, ...current]);
    setActiveThreadId(data.id);
    setCompletedThreadIds((current) => current.filter((id) => id !== data.id));
    clearPreviewInactivityTimer();
    setMessages([]);
    return data.id;
  }, [agentId, clearPreviewInactivityTimer, supabase, user.id, workspace.id]);

  const loadRunDetails = useCallback(async (runId: string | null) => {
    if (!runId) {
      setRunSteps([]);
      setRunApprovals([]);
      return;
    }

    const [{ data: stepData, error: stepError }, { data: approvalData, error: approvalError }] =
      await Promise.all([
        supabase
          .from('run_steps')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: true }),
        supabase
          .from('run_approvals')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: true }),
      ]);

    if (stepError) {
      throw stepError;
    }

    if (approvalError) {
      throw approvalError;
    }

    setRunSteps((stepData ?? []) as RunStepRecord[]);
    setRunApprovals((approvalData ?? []) as RunApprovalRecord[]);
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [agentResult, threadResult, runResult, connectionResult, knowledgeResult, draftResult] = await Promise.all([
          supabase.from('agents').select('*').eq('id', agentId).single(),
          supabase
            .from('chat_threads')
            .select('*')
            .eq('agent_id', agentId)
            .order('updated_at', { ascending: false }),
          supabase
            .from('runs')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })
            .limit(6),
          supabase
            .from('agent_connections')
            .select('connection:connections(*)')
            .eq('agent_id', agentId),
          supabase
            .from('agent_knowledge_sources')
            .select('source:knowledge_sources(*)')
            .eq('agent_id', agentId),
          supabase
            .from('agent_drafts')
            .select('definition')
            .eq('agent_id', agentId)
            .maybeSingle(),
        ]);

        if (agentResult.error) {
          throw agentResult.error;
        }

        if (knowledgeResult.error) {
          throw knowledgeResult.error;
        }

        if (!isMounted) {
          return;
        }

        const loadedAgent = agentResult.data as AgentRecord;
        const threadRows = (threadResult.data ?? []) as ThreadRecord[];
        const runRows = (runResult.data ?? []) as RunRecord[];
        const firstThreadId =
          threadRows[0]?.id ?? (await createThread(loadedAgent.name));

        setAgent(loadedAgent);
        setThreads(threadRows);
        setRuns(runRows);
        setSelectedRunId(runRows[0]?.id ?? null);
        setConnections(
          ((connectionResult.data ?? []) as unknown as AgentConnectionJoinRow[])
            .map((item) =>
              Array.isArray(item.connection) ? item.connection[0] ?? null : item.connection,
            )
            .filter(
              (connection): connection is ConnectionRecord =>
                Boolean(connection && isChatIntegrationSlug(connection.toolkit_slug)),
            )
            .map((connection) => ({
              ...connection,
              status: getEffectiveConnectionStatus(connection),
            })),
        );
        setKnowledgeSources(
          ((knowledgeResult.data ?? []) as unknown as AgentKnowledgeJoinRow[])
            .map((item) =>
              Array.isArray(item.source) ? item.source[0] ?? null : item.source,
            )
            .filter(Boolean) as KnowledgeSourceRecord[],
        );
        setEndChatPolicy(
          extractEndChatPolicyFromDefinition(draftResult.data?.definition ?? null),
        );
        setActiveThreadId(firstThreadId);
        await loadMessages(firstThreadId);
        await loadRunDetails(runRows[0]?.id ?? null);
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Failed to load agent preview.';
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
  }, [agentId, createThread, loadMessages, loadRunDetails, showToast, supabase]);

  useEffect(() => {
    return () => {
      clearPreviewInactivityTimer();
    };
  }, [clearPreviewInactivityTimer]);

  const handleSendMessage = async (value: string) => {
    const content = value.trim();

    if (!content) {
      return;
    }

    if (isActiveThreadCompleted) {
      return;
    }

    clearPreviewInactivityTimer();

    setIsSubmitting(true);
    const optimisticMessage: MessageRecord = {
      id: `optimistic-${Date.now()}`,
      thread_id: activeThreadId ?? 'pending',
      workspace_id: workspace.id,
      role: 'user',
      content,
      tool_name: null,
      tool_call_id: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setDraftMessage('');

    try {
      const threadId = activeThreadId ?? (await createThread(agent?.name));
      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          message: content,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to run agent.');
      }

      setActiveThreadId(payload.threadId);
      if (payload.sessionCompleted) {
        setCompletedThreadIds((current) =>
          current.includes(payload.threadId)
            ? current
            : [...current, payload.threadId],
        );
      } else if (
        endChatPolicy.enabled &&
        endChatPolicy.inactivityTimeoutSeconds &&
        payload.threadId
      ) {
        const timerId = window.setTimeout(() => {
          setCompletedThreadIds((current) =>
            current.includes(payload.threadId)
              ? current
              : [...current, payload.threadId],
          );
        }, endChatPolicy.inactivityTimeoutSeconds * 1000);
        setPreviewInactivityTimerId(timerId);
      }
      await Promise.all([
        loadMessages(payload.threadId),
        supabase
          .from('runs')
          .select('*')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false })
          .limit(6)
          .then(async ({ data }) => {
            const nextRuns = (data ?? []) as RunRecord[];
            setRuns(nextRuns);
            setSelectedRunId(payload.runId ?? nextRuns[0]?.id ?? null);
            await loadRunDetails(payload.runId ?? nextRuns[0]?.id ?? null);
          }),
      ]);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      const message =
        error instanceof Error ? error.message : 'Failed to run agent.';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col gap-6 overflow-hidden bg-background px-4 py-4 sm:px-6 lg:px-8 lg:py-6 xl:flex-row">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-low">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-6 py-5">
          <div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              {agent?.name ?? 'Agent Preview'}
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-on-surface-variant/60">
              Live Phase 2 Runtime
            </p>
            <div className="mt-4">
              <AgentViewTabs agentId={agentId} current="preview" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void createThread(agent?.name)}
              className="rounded-full border border-outline-variant/15 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              New Session
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-surface-container-high" />
            ))
          ) : (
            <>
              {visibleMessages.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest p-8 text-center">
                  <p className="font-headline text-xl font-bold text-on-surface">
                    Start the first conversation
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
                    Send a message to test the live runtime and see how the assistant responds.
                  </p>
                </div>
              ) : null}

              {visibleMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] space-y-3">
                    <div
                      className={`rounded-[1.5rem] px-4 py-3 text-sm leading-7 ${
                        message.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-lowest text-on-surface'
                      }`}
                    >
                      {message.content}
                    </div>
                    {message.role === 'assistant' && getKnowledgeMatches(message).length > 0 ? (
                      <div className="flex flex-wrap gap-2 px-1">
                        {getKnowledgeMatches(message).map((match) => (
                          <span
                            key={`${message.id}-${match.chunk_id}`}
                            className="rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface-variant"
                          >
                            {match.source_name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest px-6 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(agent?.starter_prompts ?? []).map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setDraftMessage(prompt);
                  void handleSendMessage(prompt);
                }}
                disabled={isSubmitting || isActiveThreadCompleted}
                className="rounded-full border border-outline-variant/15 px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                {prompt}
              </button>
            ))}
          </div>
          {isActiveThreadCompleted ? (
            <div className="mb-3 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
              This session has ended. Start a new session to continue.
            </div>
          ) : null}
          <div className="flex items-center gap-3 rounded-[1.75rem] border border-outline-variant/10 bg-surface-container px-3 py-3 ring-primary/20 focus-within:ring-2">
            <input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              disabled={isActiveThreadCompleted}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage(draftMessage);
                }
              }}
              className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-on-surface-variant/50"
              placeholder={
                isActiveThreadCompleted
                  ? 'Start a new session to continue...'
                  : 'Send a real message through the runtime...'
              }
            />
            <button
              onClick={() => void handleSendMessage(draftMessage)}
              disabled={isSubmitting || isActiveThreadCompleted}
              className="signature-gradient rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? 'Running...' : 'Send'}
            </button>
          </div>
        </div>
      </section>

      <aside className="min-h-0 w-full space-y-6 overflow-y-auto pr-2 xl:h-full xl:w-88 hide-scrollbar">
        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            Agent Summary
          </p>
          <h2 className="mt-4 font-headline text-2xl font-bold text-on-surface">
            {agent?.name ?? 'Loading...'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {agent?.description || 'No description yet.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {agent?.model ?? 'openai/gpt-4o-mini'}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {agent?.status ?? 'draft'}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {threads.length} sessions
            </span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
              Knowledge Sources
            </p>
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {knowledgeSources.length} attached
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {knowledgeSources.length === 0 ? (
              <p className="rounded-2xl bg-surface-container px-4 py-4 text-sm text-on-surface-variant">
                No knowledge sources are attached to this agent yet.
              </p>
            ) : (
              knowledgeSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-2xl bg-surface-container px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{source.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {source.chunk_count} chunks
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getKnowledgeStatusTone(source.status)}`}
                  >
                    {source.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            Connected Tools
          </p>
          <div className="mt-5 space-y-3">
            {connections.length === 0 ? (
              <p className="rounded-2xl bg-surface-container px-4 py-4 text-sm text-on-surface-variant">
                No connected toolkits are attached to this agent yet.
              </p>
            ) : (
              connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-2xl bg-surface-container px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {connection.display_name}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {connection.account_label}
                    </p>
                  </div>
                  <span className="rounded-full bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {connection.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            Recent Runs
          </p>
          <div className="mt-5 space-y-3">
            {runs.length === 0 ? (
              <p className="rounded-2xl bg-surface-container px-4 py-4 text-sm text-on-surface-variant">
                No runs yet.
              </p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => {
                    setSelectedRunId(run.id);
                    void loadRunDetails(run.id);
                  }}
                  className={`w-full rounded-2xl px-4 py-4 text-left transition-colors ${
                    selectedRunId === run.id
                      ? 'bg-primary/5 ring-1 ring-primary/20'
                      : 'bg-surface-container hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-on-surface">{run.status}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      {formatRelativeDate(run.created_at)}
                    </span>
                  </div>
                  {run.error_message ? (
                    <p className="mt-2 text-xs leading-6 text-error">{run.error_message}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            Run Trace
          </p>
          <div className="mt-5 space-y-3">
            {runSteps.length === 0 ? (
              <p className="rounded-2xl bg-surface-container px-4 py-4 text-sm text-on-surface-variant">
                No trace data yet.
              </p>
            ) : (
              runSteps.map((step) => (
                <div key={step.id} className="rounded-2xl bg-surface-container px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-on-surface">{step.title}</p>
                    <span className="rounded-full bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {step.status}
                    </span>
                  </div>
                  {step.detail ? (
                    <p className="mt-2 text-xs leading-6 text-on-surface-variant">{step.detail}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
            Approvals
          </p>
          <div className="mt-5 space-y-3">
            {runApprovals.length === 0 ? (
              <p className="rounded-2xl bg-surface-container px-4 py-4 text-sm text-on-surface-variant">
                No approval requests on this run.
              </p>
            ) : (
              runApprovals.map((approval) => (
                <div key={approval.id} className="rounded-2xl bg-surface-container px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-on-surface">{approval.title}</p>
                    <span className="rounded-full bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {approval.status}
                    </span>
                  </div>
                  {approval.detail ? (
                    <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                      {approval.detail}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
