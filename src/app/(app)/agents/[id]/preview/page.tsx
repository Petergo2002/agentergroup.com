'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAppContext } from '@/components/app/AppContext';
import { hasInternalAssistantsEnabled } from '@/lib/assistants/feature-flags';
import { consumeChatStream, createChatRequestError } from '@/lib/chat-stream';
import { AgentViewTabs } from '@/components/agents/AgentViewTabs';
import { useLanguage } from '@/components/i18n/LanguageProvider';
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

  const allMatches = value as KnowledgeMatchRecord[];
  
  const uniqueNames = new Set<string>();
  const uniqueMatches: typeof allMatches = [];
  
  for (const match of allMatches) {
    if (!uniqueNames.has(match.source_name)) {
      uniqueNames.add(match.source_name);
      uniqueMatches.push(match);
    }
  }

  return uniqueMatches;
}

export default function AgentPreviewPage() {
  const [supabase] = useState(() => createClient());
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { workspace, user } = useAppContext();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const agentId = params.id;
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [, setConnections] = useState<ConnectionRecord[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceRecord[]>([]);
  const [, setThreads] = useState<ThreadRecord[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStepRecord[]>([]);
  const [, setRunApprovals] = useState<RunApprovalRecord[]>([]);
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
  const turnInFlightRef = useRef(false);

  useEffect(() => {
    if (!agent || agent.surface !== 'assistant' || hasInternalAssistantsEnabled(workspace)) {
      return;
    }

    showToast(t('agentBuilder.internalAssistantsDisabled'), 'error');
    router.replace('/dashboard');
  }, [agent, router, showToast, t, workspace]);

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

  const createThreadRecord = useCallback(async (title?: string) => {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        workspace_id: workspace.id,
        agent_id: agentId,
        source: 'preview',
        created_by: user.id,
        title: title ?? t('assistants.newChat'),
      })
      .select()
      .single();

    if (error || !data) {
      throw error ?? new Error(t('agentPreview.createThreadError'));
    }

    return data as ThreadRecord;
  }, [agentId, supabase, t, user.id, workspace.id]);

  const createThread = useCallback(async (
    title?: string,
    options?: { resetMessages?: boolean },
  ) => {
    const nextThread = await createThreadRecord(title);

    setThreads((current) => [nextThread, ...current]);
    setActiveThreadId(nextThread.id);
    setCompletedThreadIds((current) => current.filter((id) => id !== nextThread.id));
    clearPreviewInactivityTimer();

    if (options?.resetMessages !== false) {
      setMessages([]);
    }

    return nextThread.id;
  }, [clearPreviewInactivityTimer, createThreadRecord]);

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

  const syncPreviewTurnState = useCallback(async (
    threadId: string,
    preferredRunId: string | null,
  ) => {
    await Promise.all([
      loadMessages(threadId),
      supabase
        .from('runs')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(6)
        .then(async ({ data, error }) => {
          if (error) {
            throw error;
          }

          const nextRuns = (data ?? []) as RunRecord[];
          const nextSelectedRunId = preferredRunId ?? nextRuns[0]?.id ?? null;
          setRuns(nextRuns);
          setSelectedRunId(nextSelectedRunId);
          await loadRunDetails(nextSelectedRunId);
        }),
    ]);
  }, [agentId, loadMessages, loadRunDetails, supabase]);

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
            .eq('source', 'preview')
            .eq('created_by', user.id)
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
        let threadRows = (threadResult.data ?? []) as ThreadRecord[];
        const runRows = (runResult.data ?? []) as RunRecord[];

        if (threadRows.length === 0) {
          const createdThread = await createThreadRecord(loadedAgent.name);
          threadRows = [createdThread];
        }

        const firstThreadId = threadRows[0]?.id ?? null;

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
        if (firstThreadId) {
          await loadMessages(firstThreadId);
        }
        await loadRunDetails(runRows[0]?.id ?? null);
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : t('agentPreview.loadError');
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
  }, [agentId, createThreadRecord, loadMessages, loadRunDetails, showToast, supabase, t, user.id]);

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

    if (isActiveThreadCompleted || turnInFlightRef.current) {
      return;
    }

    turnInFlightRef.current = true;
    clearPreviewInactivityTimer();
    setIsSubmitting(true);
    let optimisticMessageId = '';
    let streamingAssistantId = '';
    let requestAccepted = false;
    let resolvedThreadId = activeThreadId ?? null;
    let resolvedRunId: string | null = null;
    let sessionCompleted = false;

    try {
      const threadId =
        activeThreadId ?? (await createThread(agent?.name, { resetMessages: false }));
      const optimisticMessage: MessageRecord = {
        id: `optimistic-${Date.now()}`,
        thread_id: threadId,
        workspace_id: workspace.id,
        role: 'user',
        content,
        tool_name: null,
        tool_call_id: null,
        metadata: {},
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      optimisticMessageId = optimisticMessage.id;
      streamingAssistantId = `streaming-assistant-${Date.now()}`;
      resolvedThreadId = threadId;
      setMessages((current) => [...current, optimisticMessage]);
      setDraftMessage('');

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

      if (!response.ok) {
        throw await createChatRequestError(response, t('agentPreview.runError'));
      }

      requestAccepted = true;
      setMessages((current) => [
        ...current,
        {
          id: streamingAssistantId,
          thread_id: resolvedThreadId ?? 'pending',
          workspace_id: workspace.id,
          role: 'assistant',
          content: '',
          tool_name: null,
          tool_call_id: null,
          metadata: {},
          created_by: null,
          created_at: new Date().toISOString(),
        },
      ]);

      await consumeChatStream(response, (event) => {
        if (event.type === 'meta') {
          resolvedThreadId = event.threadId;
          resolvedRunId = event.runId;
          setActiveThreadId(event.threadId);
          return;
        }

        if (event.type === 'complete') {
          resolvedThreadId = event.threadId;
          resolvedRunId = event.runId;
          sessionCompleted = event.sessionCompleted;
          setActiveThreadId(event.threadId);
          return;
        }

        if (event.type === 'delta') {
          setMessages((current) =>
            current.map((message) =>
              message.id === streamingAssistantId
                ? {
                    ...message,
                    content: message.content + event.delta,
                  }
                : message,
            ),
          );
        }
      });

      if (!resolvedThreadId) {
        throw new Error(t('agentPreview.runError'));
      }

      const completedThreadId = resolvedThreadId;

      if (sessionCompleted) {
        setCompletedThreadIds((current) =>
          current.includes(completedThreadId)
            ? current
            : [...current, completedThreadId],
        );
      } else if (
        endChatPolicy.enabled &&
        endChatPolicy.inactivityTimeoutSeconds &&
        completedThreadId
      ) {
        const timerId = window.setTimeout(() => {
          setCompletedThreadIds((current) =>
            current.includes(completedThreadId)
              ? current
              : [...current, completedThreadId],
          );
        }, endChatPolicy.inactivityTimeoutSeconds * 1000);
        setPreviewInactivityTimerId(timerId);
      }

      try {
        await syncPreviewTurnState(completedThreadId, resolvedRunId);
      } catch (syncError) {
        showToast(
          syncError instanceof Error
            ? syncError.message
            : t('agentPreview.loadError'),
          'error',
        );
      }
    } catch (error) {
      if (!requestAccepted) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticMessageId),
        );
      } else {
        if (resolvedThreadId) {
          await syncPreviewTurnState(resolvedThreadId, resolvedRunId).catch(() => null);
        }

        setMessages((current) => [
          ...current.filter((message) => message.id !== streamingAssistantId),
          {
            id: `stream-error-${Date.now()}`,
            thread_id: resolvedThreadId ?? activeThreadId ?? 'pending',
            workspace_id: workspace.id,
            role: 'assistant',
            content:
              error instanceof Error ? error.message : t('agentPreview.runError'),
            tool_name: null,
            tool_call_id: null,
            metadata: {},
            created_by: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      const message =
        error instanceof Error ? error.message : t('agentPreview.runError');
      showToast(message, 'error');
    } finally {
      turnInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const surfaceLabel = agent?.surface === 'widget' ? t('agentPreview.websiteWidget') : t('agentPreview.conversationHub');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="shrink-0 flex h-20 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60">
                {t('agentPreview.blueprint')}
              </span>
              <span className="text-on-surface-variant/20 text-[10px]">/</span>
              <h1 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                {agent?.name || t('assistants.agentFallback')}
              </h1>
              {agent ? (
                <div className="ml-3 flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <div className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                  {surfaceLabel}
                </div>
              ) : null}
            </div>

            <div className="h-4 w-[1px] bg-outline-variant/20" />

            <AgentViewTabs agentId={agentId} current="preview" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden flex-col items-end xl:flex">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 line-clamp-1">{t('agentPreview.runtimeStatus')}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(var(--success-rgb),0.5)]" />
              <p className="text-[10px] font-medium tracking-wide text-on-surface-variant whitespace-nowrap">
                {t('agentPreview.runtimeReady')}
              </p>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-outline-variant/20" />

          <button
            onClick={() => void createThread(agent?.name)}
            className="h-10 px-6 rounded-2xl border border-outline-variant/15 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container transition-all active:scale-95"
          >
            {t('agentPreview.newSession')}
          </button>
        </div>
      </header>

      <main className="flex flex-1 min-h-0 divide-x divide-outline-variant/10">
        {/* Chat Section */}
        <div className="flex flex-1 flex-col min-w-0 bg-surface-container-low/30">
          <div className="flex-1 overflow-y-auto px-12 py-10 space-y-8 scroll-smooth hide-scrollbar">
            {isLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className="h-24 w-1/2 animate-pulse rounded-[2rem] bg-surface-container" />
                  </div>
                ))}
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-lg mx-auto">
                <div className="h-16 w-16 rounded-[2rem] bg-primary/5 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-primary">chat_bubble</span>
                </div>
                <h2 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
                  {t('agentPreview.startConversation')}
                </h2>
                <p className="text-on-surface-variant/60 leading-relaxed text-sm">
                  {t('agentPreview.startConversationDescription', {
                    name: agent?.name || t('assistants.agentFallback'),
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-8 pb-4">
                {visibleMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] space-y-3 ${message.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                      <div
                        className={`rounded-[2rem] px-6 py-4 text-sm leading-7 shadow-sm transition-all hover:shadow-md ${
                          message.role === 'user'
                            ? 'bg-on-surface text-background font-medium'
                            : 'bg-surface-container-lowest border border-outline-variant/10 text-on-surface'
                        }`}
                      >
                        {message.content ||
                          (message.id.startsWith('streaming-assistant-')
                            ? t('agentPreview.running')
                            : '')}
                      </div>
                      
                      {message.role === 'assistant' && getKnowledgeMatches(message).length > 0 && (
                        <div className="flex flex-wrap gap-2 px-2">
                          {getKnowledgeMatches(message).map((match) => (
                            <div
                              key={`${message.id}-${match.chunk_id}`}
                              className="flex items-center gap-1.5 rounded-full border border-outline-variant/10 bg-surface-container-lowest px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-low transition-colors"
                            >
                              <div className="h-1 w-1 rounded-full bg-primary" />
                              {match.source_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="shrink-0 border-t border-outline-variant/10 bg-surface/50 p-8 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Starter Prompts */}
              <div className="flex flex-wrap gap-2 justify-center">
                {(agent?.starter_prompts ?? []).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setDraftMessage(prompt);
                      void handleSendMessage(prompt);
                    }}
                    disabled={isSubmitting || isActiveThreadCompleted}
                    className="h-8 px-4 rounded-full border border-outline-variant/15 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low hover:text-on-surface transition-all active:scale-95 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {isActiveThreadCompleted && (
                <div className="text-center py-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
                    {t('agentPreview.sessionEnded')}
                  </span>
                </div>
              )}

              <div className="relative group focus-within:scale-[1.01] transition-all duration-300">
                <input
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  disabled={isActiveThreadCompleted || isSubmitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage(draftMessage);
                    }
                  }}
                  className="w-full h-14 pl-6 pr-32 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm outline-none focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 text-sm placeholder:text-on-surface-variant/40 transition-all disabled:opacity-50"
                  placeholder={isActiveThreadCompleted ? t('agentPreview.sessionCompleted') : t('agentPreview.typeMessage')}
                />
                <div className="absolute right-2 top-2 bottom-2 p-1 flex items-center gap-2">
                  <button
                    onClick={() => void handleSendMessage(draftMessage)}
                    disabled={isSubmitting || isActiveThreadCompleted || !draftMessage.trim()}
                    className="h-full px-6 rounded-xl bg-on-surface text-background text-[11px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? t('agentPreview.running') : t('agentPreview.send')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Sidebar */}
        <aside className="w-88 shrink-0 overflow-y-auto bg-surface-container-lowest/50 p-6 space-y-6 hide-scrollbar">
          {/* Agent Summary Card */}
          <section className="p-6 rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">{t('agentPreview.registry')}</span>
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            </div>
            <h2 className="font-headline text-xl font-bold text-on-surface tracking-tight leading-tight">
              {agent?.name || t('common.loading')}
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-on-surface-variant/70 min-h-[3em]">
              {agent?.description || t('analytics.monitoringSession')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-full border border-outline-variant/10 bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {agent?.model?.split('/').pop() || 'GPT-4o'}
              </div>
              <div className="px-3 py-1.5 rounded-full border border-outline-variant/10 bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {t('agentPreview.previewMode')}
              </div>
            </div>
          </section>

          {/* Activity Cards */}
          <div className="space-y-4">
            {/* Knowledge Sources */}
            <div className="p-6 rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('agentPreview.knowledge')}</span>
                <span className="text-[10px] font-bold text-primary">{t('agentPreview.activeCount', { count: knowledgeSources.length })}</span>
              </div>
              <div className="space-y-2">
                {knowledgeSources.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant/40 text-center py-4 border border-dashed border-outline-variant/20 rounded-2xl">
                    {t('agentPreview.noSourcesAttached')}
                  </p>
                ) : (
                  knowledgeSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/5">
                      <span className="text-xs font-semibold text-on-surface truncate pr-2">{source.name}</span>
                      <div className={`h-1.5 w-1.5 rounded-full ${getKnowledgeStatusTone(source.status).includes('success') ? 'bg-success' : 'bg-warning'}`} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Run History */}
            <div className="p-6 rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('agentPreview.recentActivity')}</span>
                <span className="text-[10px] font-bold text-on-surface-variant/30">{t('agentPreview.runs', { count: runs.length })}</span>
              </div>
              <div className="space-y-3">
                {runs.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant/40 text-center py-4 border border-dashed border-outline-variant/20 rounded-2xl">
                    {t('agentPreview.noRuntimeActivity')}
                  </p>
                ) : (
                  runs.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => {
                        setSelectedRunId(run.id);
                        void loadRunDetails(run.id);
                      }}
                      className={`w-full group p-3 rounded-2xl border transition-all ${
                        selectedRunId === run.id
                          ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10'
                          : 'bg-surface-container-low/50 border-outline-variant/5 hover:bg-surface-container-low hover:border-outline-variant/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${run.status === 'succeeded' ? 'text-success' : 'text-primary'}`}>
                          {run.status}
                        </span>
                        <span className="text-[9px] font-medium text-on-surface-variant/40">
                          {formatRelativeDate(run.created_at, language)}
                        </span>
                      </div>
                      {run.error_message ? (
                        <p className="text-[10px] text-error line-clamp-1 mt-1 opacity-80">{run.error_message}</p>
                      ) : (
                        <div className="h-1 w-full bg-on-surface/5 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full bg-success transition-all duration-500 ${run.status === 'succeeded' ? 'w-full' : 'w-1/2'}`} />
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Run Trace */}
            <div className="p-6 rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('agentPreview.stepTrace')}</span>
                {runSteps.length > 0 && <span className="text-[10px] font-bold text-primary">{t('common.live')}</span>}
              </div>
              <div className="space-y-3">
                {runSteps.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant/40 text-center py-4 border border-dashed border-outline-variant/20 rounded-2xl">
                    {t('agentPreview.selectRunToTrace')}
                  </p>
                ) : (
                  runSteps.map((step) => (
                    <div key={step.id} className="relative pl-5 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-[1px] before:bg-outline-variant/20 last:before:h-2">
                      <div className="absolute left-[-3px] top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-4 ring-surface-container-lowest" />
                      <p className="text-[11px] font-bold text-on-surface line-clamp-1">{step.title}</p>
                      <p className="text-[10px] text-on-surface-variant/60 leading-relaxed mt-1 line-clamp-2">
                        {step.detail}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
