'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  FileText,
  Menu,
  Pencil,
  Plus,
  X,
  Paperclip,
  Brain,
  Send,
} from 'lucide-react';
import { useAppContext } from '@/components/app/AppContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { consumeChatStream, createChatRequestError } from '@/lib/chat-stream';
import { formatRelativeDate } from '@/lib/utils';
import type {
  AssistantConversationMessage,
  AssistantDetailResponse,
  AssistantThreadSummary,
} from '@/lib/types';

function getThreadMonogram(title: string) {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return 'AG';
  }

  return words
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AssistantDetailPage() {
  const params = useParams<{ id: string }>();
  const assistantId = params.id;
  const { profile } = useAppContext();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [detail, setDetail] = useState<AssistantDetailResponse | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isThreadRailCollapsed, setIsThreadRailCollapsed] = useState(false);
  const [isMobileThreadsOpen, setIsMobileThreadsOpen] = useState(false);
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState('');
  const turnInFlightRef = useRef(false);

  const loadAssistant = useCallback(
    async (threadId?: string | null) => {
      const search = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
      const response = await fetch(`/api/assistants/${assistantId}${search}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || t('assistants.detailLoadError'));
      }

      setDetail(payload as AssistantDetailResponse);
      return payload as AssistantDetailResponse;
    },
    [assistantId, t],
  );

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const next = await loadAssistant();
        if (!isMounted) return;
        setDetail(next);
      } catch (error) {
        if (!isMounted) return;
        showToast(
          error instanceof Error ? error.message : t('assistants.detailLoadError'),
          'error',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [loadAssistant, showToast, t]);

  const activeThreadId = detail?.activeThreadId ?? null;
  const activeThread =
    detail?.threads.find((thread) => thread.id === activeThreadId) ?? null;
  const starterPrompts = detail?.assistant.starter_prompts ?? [];
  const hasMessages = (detail?.messages.length ?? 0) > 0;
  const isPaused = detail?.assistant.status === 'paused';

  const handleCreateThread = async () => {
    if (!detail || isPaused) {
      return;
    }

    setIsCreatingThread(true);

    try {
      const response = await fetch(`/api/assistants/${assistantId}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.thread) {
        throw new Error(payload?.error || t('assistants.createChatError'));
      }

      setDetail((current) =>
        current
          ? {
              ...current,
              activeThreadId: payload.thread.id,
              threads: [payload.thread, ...current.threads],
              messages: [],
            }
          : current,
      );
      setDraftMessage('');
      setIsMobileThreadsOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('assistants.createChatError'),
        'error',
      );
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    if (!detail || threadId === activeThreadId) {
      return;
    }

    setIsLoading(true);

    try {
      await loadAssistant(threadId);
      setIsMobileThreadsOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('assistants.loadChatError'),
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (value: string) => {
    if (!detail) {
      return;
    }

    const content = value.trim();

    if (!content || isPaused || turnInFlightRef.current) {
      return;
    }

    turnInFlightRef.current = true;
    const optimisticMessage: AssistantConversationMessage = {
      id: `optimistic-${Date.now()}`,
      threadId: activeThreadId ?? 'pending',
      role: 'user',
      content,
      toolName: null,
      toolCallId: null,
      metadata: {},
      createdBy: profile.id,
      createdAt: new Date().toISOString(),
      senderName: profile.full_name || profile.email || null,
      downloads: [],
    };

    const streamingAssistantId = `streaming-assistant-${Date.now()}`;
    let requestAccepted = false;
    let resolvedThreadId = activeThreadId ?? null;

    setIsSending(true);
    setDetail((current) =>
      current
        ? {
            ...current,
            messages: [...current.messages, optimisticMessage],
          }
        : current,
    );
    setDraftMessage('');

    try {
      const response = await fetch(`/api/assistants/${assistantId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: activeThreadId ?? undefined,
          message: content,
        }),
      });

      if (!response.ok) {
        throw await createChatRequestError(
          response,
          t('assistants.sendMessageError'),
        );
      }

      requestAccepted = true;
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages,
                {
                  id: streamingAssistantId,
                  threadId: resolvedThreadId ?? 'pending',
                  role: 'assistant',
                  content: '',
                  toolName: null,
                  toolCallId: null,
                  metadata: {},
                  createdBy: null,
                  createdAt: new Date().toISOString(),
                  senderName: current.assistant.name ?? null,
                  downloads: [],
                },
              ],
            }
          : current,
      );

      await consumeChatStream(response, (event) => {
        if (event.type === 'meta') {
          resolvedThreadId = event.threadId;
          return;
        }

        if (event.type === 'complete') {
          resolvedThreadId = event.threadId;
          return;
        }

        if (event.type === 'delta') {
          setDetail((current) =>
            current
              ? {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === streamingAssistantId
                      ? {
                          ...message,
                          content: message.content + event.delta,
                        }
                      : message,
                  ),
                }
              : current,
          );
        }
      });

      if (!resolvedThreadId) {
        throw new Error(t('assistants.sendMessageError'));
      }

      try {
        await loadAssistant(resolvedThreadId);
      } catch (syncError) {
        showToast(
          syncError instanceof Error
            ? syncError.message
            : t('assistants.detailLoadError'),
          'error',
        );
      }

      setIsMobileThreadsOpen(false);
    } catch (error) {
      if (!requestAccepted) {
        setDetail((current) =>
          current
            ? {
                ...current,
                messages: current.messages.filter(
                  (message) => message.id !== optimisticMessage.id,
                ),
              }
            : current,
        );
      } else {
        if (resolvedThreadId) {
          await loadAssistant(resolvedThreadId).catch(() => null);
        }

        setDetail((current) =>
          current
            ? {
                ...current,
                messages: [
                  ...current.messages.filter(
                    (message) => message.id !== streamingAssistantId,
                  ),
                  {
                    id: `stream-error-${Date.now()}`,
                    threadId: resolvedThreadId ?? activeThreadId ?? 'pending',
                    role: 'assistant',
                    content:
                      error instanceof Error
                        ? error.message
                        : t('assistants.sendMessageError'),
                    toolName: null,
                    toolCallId: null,
                    metadata: {},
                    createdBy: null,
                    createdAt: new Date().toISOString(),
                    senderName: current.assistant.name ?? null,
                    downloads: [],
                  },
                ],
              }
            : current,
        );
      }

      showToast(
        error instanceof Error ? error.message : t('assistants.sendMessageError'),
        'error',
      );
    } finally {
      turnInFlightRef.current = false;
      setIsSending(false);
    }
  };

  const handleStartThreadRename = (thread: AssistantThreadSummary) => {
    setEditingThreadId(thread.id);
    setEditingThreadTitle(thread.title);
  };

  const handleCancelThreadRename = () => {
    setEditingThreadId(null);
    setEditingThreadTitle('');
  };

  const handleRenameThread = async (threadId: string) => {
    const nextTitle = editingThreadTitle.trim();

    if (!detail || !nextTitle) {
      handleCancelThreadRename();
      return;
    }

    try {
      const response = await fetch(`/api/assistants/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          title: nextTitle,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.thread) {
        throw new Error(payload?.error || t('assistants.renameChatError'));
      }

      setDetail((current) =>
        current
          ? {
              ...current,
              threads: current.threads.map((thread) =>
                thread.id === threadId
                  ? {
                      ...thread,
                      title: payload.thread.title,
                    }
                  : thread,
              ),
            }
          : current,
      );
      handleCancelThreadRename();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('assistants.renameChatError'),
        'error',
      );
    }
  };

  const renderThreadItem = (thread: AssistantThreadSummary, compact = false) => {
    const isActive = thread.id === activeThreadId;
    const isEditing = editingThreadId === thread.id;

    if (compact) {
      return (
        <button
          key={thread.id}
          type="button"
          title={thread.title}
          onClick={() => void handleSelectThread(thread.id)}
          className={`group flex h-11 w-11 items-center justify-center rounded-2xl border text-[10px] font-bold transition-all ${
            isActive
              ? 'border-primary/20 bg-primary text-on-primary shadow-[0_8px_16px_rgba(0,0,0,0.24)]'
              : 'border-outline-variant/10 bg-surface-container-low text-on-surface-variant hover:border-primary/15 hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span>{getThreadMonogram(thread.title)}</span>
        </button>
      );
    }

    return (
      <div
        key={thread.id}
        role="button"
        tabIndex={0}
        onClick={() => void handleSelectThread(thread.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void handleSelectThread(thread.id);
          }
        }}
        className={`w-full max-w-full group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/15 ${
          isActive
            ? 'border-primary/15 bg-surface-container-low shadow-[0_8px_24px_rgba(0,0,0,0.22)]'
            : 'border-transparent bg-transparent hover:bg-surface-container-low/70'
        }`}
      >
        <div className="flex min-w-0 max-w-full items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wider ${
              isActive
                ? 'bg-primary/12 text-primary'
                : 'bg-surface-container text-on-surface-variant group-hover:bg-surface-container-high'
            }`}
          >
            {getThreadMonogram(thread.title)}
          </div>
          <div className="min-w-0 max-w-full flex-1 overflow-hidden">
            <div className="flex min-w-0 max-w-full items-start justify-between gap-2">
              {isEditing ? (
                <div
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    autoFocus
                    value={editingThreadTitle}
                    onChange={(event) => setEditingThreadTitle(event.target.value)}
                    onBlur={() => void handleRenameThread(thread.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleRenameThread(thread.id);
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        handleCancelThreadRename();
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-2.5 py-1.5 text-[13px] font-semibold text-on-surface outline-none ring-0 focus:border-primary/30"
                  />
                  <button
                    type="button"
                    aria-label={t('assistants.saveChatTitle')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRenameThread(thread.id);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <p className={`truncate text-[13px] font-semibold transition-colors ${isActive ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                    {thread.title}
                  </p>
                  <button
                    type="button"
                    aria-label={t('assistants.renameChat')}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStartThreadRename(thread);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all hover:bg-surface-container hover:text-on-surface group-hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-relaxed transition-colors ${isActive ? 'text-on-surface-variant' : 'text-on-surface-variant/75 group-hover:text-on-surface-variant'}`}>
              {thread.lastMessageSnippet || t('assistants.newConversation')}
            </p>
          </div>
        </div>
        {isActive && (
          <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
      </div>
    );
  };

  const renderStarterPrompts = (centered = false) => {
    if (starterPrompts.length === 0) {
      return null;
    }

    return (
      <div
        className={`flex flex-wrap gap-2.5 ${
          centered ? 'justify-center' : 'justify-start'
        }`}
      >
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void handleSendMessage(prompt)}
            disabled={isSending || isPaused}
            className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-2.5 text-[13px] font-medium text-on-surface-variant shadow-sm transition-all hover:border-primary/20 hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    );
  };

  const renderComposer = (hero = false) => (
    <div className={`relative w-full ${hero ? 'max-w-[760px] mx-auto' : ''}`}>
      <div
        className="relative overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest backdrop-blur-3xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.24)] transition-all duration-300 focus-within:border-primary/20 focus-within:bg-surface-container-low focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
      >
        <div className="flex flex-col">
          <div className="min-w-0 flex-1 px-5 pt-4">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                disabled={isSending || isPaused}
                rows={1}
                onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage(draftMessage);
                }
              }}
                className={`w-full resize-none appearance-none border-0 bg-transparent p-0 text-[15px] leading-[1.6] text-on-surface outline-none ring-0 shadow-none placeholder:text-on-surface-variant/70 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none ${
                  hero ? 'min-h-[60px]' : 'min-h-[44px] max-h-48'
                }`}
                style={{ boxShadow: 'none' }}
                placeholder={
                  isPaused
                    ? t('assistants.pausedPlaceholder')
                    : isDeepThinking 
                    ? t('assistants.thinkingPlaceholder')
                    : t('assistants.messagePlaceholder', {
                        name: detail?.assistant.name ?? t('assistants.agentFallback'),
                      })
              }
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-3 pt-2">
            <div className="flex items-center gap-1.5">
               <button 
                type="button" 
                onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                className={`flex h-9 px-3 items-center gap-2 rounded-full text-[12px] font-medium transition-all ${
                  isAttachmentOpen ? 'bg-primary/12 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
               >
                <Paperclip className="h-4 w-4" />
                <span>{t('assistants.attach')}</span>
               </button>
               <button 
                type="button" 
                onClick={() => setIsDeepThinking(!isDeepThinking)}
                className={`flex h-9 px-3 items-center gap-2 rounded-full text-[12px] font-medium transition-all ${
                  isDeepThinking ? 'bg-primary/12 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
               >
                <Brain className="h-4 w-4" />
                <span>{t('assistants.deepThinking')}</span>
               </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSendMessage(draftMessage)}
              disabled={isSending || isPaused || !draftMessage.trim()}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
                draftMessage.trim()
                  ? 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(0,0,0,0.24)]'
                  : 'bg-surface-container-high text-on-surface-variant'
              } disabled:cursor-not-allowed`}
            >
              {isSending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {hero && (
        <div className="mt-6 flex items-center justify-center gap-6">
             <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-semibold tracking-wide uppercase">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t('assistants.support')}
             </div>
             <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-semibold tracking-wide uppercase">
                {t('assistants.privacyProtection')}
             </div>
             <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-semibold tracking-wide uppercase">
                {t('assistants.aiPowered')}
             </div>
        </div>
      )}
    </div>
  );

  const renderExpandedRail = (mobile = false) => (
      <div className="flex h-full min-h-0 min-w-0 overflow-hidden flex-col bg-transparent">
      <div className="flex items-center justify-between gap-4 px-5 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant">
          {t('assistants.history')}
        </p>
        <button
          type="button"
          onClick={() =>
            mobile ? setIsMobileThreadsOpen(false) : setIsThreadRailCollapsed(true)
          }
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
        >
          {mobile ? <X className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-6 custom-scrollbar">
        {isLoading && !detail ? (
              <div className="space-y-2 px-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-2xl bg-surface-container-low"
                  />
                ))}
              </div>
        ) : detail && detail.threads.length > 0 ? (
          <div className="min-w-0 space-y-1 overflow-hidden">
            {detail.threads.map((thread) => renderThreadItem(thread))}
          </div>
        ) : (
          <div className="mx-2 mt-4 rounded-2xl border border-dashed border-outline-variant/15 bg-surface-container-low/50 px-4 py-8 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold text-on-surface-variant">{t('assistants.noActivityYet')}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background text-on-surface selection:bg-primary/20">
      {/* Immersive Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute -right-[15%] top-[10%] h-[50%] w-[50%] rounded-full bg-primary-container/8 blur-[120px]" />
        <div className="absolute left-[30%] top-[40%] h-[40%] w-[40%] rounded-full bg-white/4 blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-surface-container-low/92" />
      </div>

      <div className="relative z-10 flex h-full flex-col overflow-hidden">
        {/* Simplified Header */}
        <header className="sticky top-0 z-40 border-b border-outline-variant/10 bg-background/78 backdrop-blur-3xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-4">
               <button
                  type="button"
                  onClick={() => setIsMobileThreadsOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high lg:hidden"
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>

                <Link
                  href="/assistants"
                  className="group flex h-10 items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-lowest pl-3 pr-4 text-[13px] font-semibold text-on-surface-variant shadow-sm transition-all hover:border-primary/20 hover:bg-surface-container"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>{t('assistants.explore')}</span>
                </Link>

                <div className="hidden h-4 w-px bg-outline-variant/30 sm:block" />

                <div className="flex items-center gap-3">
                    <div className="hidden sm:block">
                        <h1 className="max-w-[30rem] truncate text-[14px] font-bold tracking-tight text-on-surface">
                          {activeThread?.title ?? detail?.assistant.name ?? t('assistants.agentFallback')}
                        </h1>
                        {activeThread ? (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-on-surface-variant">
                            {detail?.assistant.name ?? t('assistants.agentFallback')}
                          </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCreateThread()}
                    disabled={isCreatingThread || isPaused || isLoading}
                    className="signature-gradient flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all hover:border-primary/25 hover:bg-primary/8 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-[0_8px_16px_rgba(0,0,0,0.24)]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                    <span>{t('assistants.newChat')}</span>
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/15 bg-surface-container text-[12px] font-bold text-on-surface-variant">
                    {profile.full_name?.[0] || profile.email?.[0]?.toUpperCase() || '?'}
                  </div>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        <div
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
            isMobileThreadsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setIsMobileThreadsOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 w-[18rem] overflow-hidden border-r border-outline-variant/10 bg-surface-container-lowest shadow-2xl transition-transform duration-400 ease-out lg:hidden ${
            isMobileThreadsOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderExpandedRail(true)}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <aside
            className={`hidden overflow-hidden border-r border-outline-variant/10 bg-surface-container-lowest/80 backdrop-blur-3xl transition-all duration-500 ease-in-out lg:flex lg:shrink-0 ${
              isThreadRailCollapsed ? 'w-[72px]' : 'w-[280px]'
            }`}
          >
            {isThreadRailCollapsed ? (
              <div className="flex h-full w-full flex-col items-center gap-4 py-6">
                <button
                  type="button"
                  onClick={() => setIsThreadRailCollapsed(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="h-px w-6 bg-outline-variant/30" />
                <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-2 pt-2 custom-scrollbar no-scrollbar">
                  {detail?.threads.map((thread) => renderThreadItem(thread, true))}
                </div>
              </div>
            ) : (
              renderExpandedRail()
            )}
          </aside>

          {/* Main Chat Interface */}
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pt-8 pb-20 sm:px-6 sm:pb-24 lg:px-12 lg:pb-28 custom-scrollbar">
                <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col relative pb-56 sm:pb-60">
                  {isPaused && (
                    <div className="mb-8 rounded-2xl border border-outline-variant/15 bg-surface-container-low/75 px-4 py-3 text-center text-[13px] font-medium text-on-surface-variant backdrop-blur-md">
                      {t('assistants.pausedBanner')}
                    </div>
                  )}

                  {hasMessages ? (
                    <div className="flex flex-1 flex-col">
                       <div className="space-y-12">
                        {detail?.messages.map((message, idx) => (
                          message.role === 'tool' ? (
                            <div
                              key={message.id}
                              className="flex animate-in fade-in slide-in-from-bottom-2 justify-center duration-500 fill-mode-both"
                              style={{ animationDelay: `${idx * 100}ms` }}
                            >
                              <div className="w-full max-w-[40rem] rounded-[1.6rem] border border-outline-variant/12 bg-surface-container-low/90 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                                      {t('assistants.pdfReady')}
                                    </p>
                                    <p className="mt-1 text-[15px] font-semibold text-on-surface">
                                      {message.content}
                                    </p>
                                    <p className="mt-1 text-[12px] text-on-surface-variant">
                                      {formatRelativeDate(message.createdAt, language)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2.5">
                                  {(message.downloads ?? []).map((download, downloadIndex) => (
                                    <a
                                      key={`${message.id}-${download.url}-${downloadIndex}`}
                                      href={`/api/assistants/${assistantId}/downloads/${message.id}?index=${downloadIndex}`}
                                      download={download.filename}
                                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2 text-[13px] font-semibold text-on-surface-variant transition-colors hover:border-primary/20 hover:bg-primary/8 hover:text-on-surface"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      <span className="truncate">{download.filename}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={message.id}
                              className={`flex animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both ${
                                message.role === 'assistant' ? 'justify-start' : 'justify-end'
                              }`}
                              style={{ animationDelay: `${idx * 100}ms` }}
                            >
                              <div className={`flex max-w-[85%] flex-col gap-3 group ${message.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                                  <div className="flex items-center gap-2 px-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                          {message.senderName || (message.role === 'assistant' ? (detail?.assistant.name ?? t('assistants.agentFallback')) : t('assistants.you'))}
                                       </span>
                                       <span className="text-[10px] text-on-surface-variant/60">
                                          {formatRelativeDate(message.createdAt, language)}
                                       </span>
                                  </div>
                                  <div
                                      className={`relative px-6 py-5 text-[15px] font-medium leading-[1.75] shadow-sm ${
                                      message.role === 'assistant'
                                          ? 'rounded-[1.4rem] rounded-tl-sm border border-outline-variant/10 bg-surface-container-low text-on-surface backdrop-blur-sm'
                                          : 'rounded-[1.4rem] rounded-tr-sm bg-primary text-on-primary shadow-[0_8px_16px_-4px_rgba(0,0,0,0.24)]'
                                      }`}
                                  >
                                      <div className="whitespace-pre-wrap selection:bg-on-primary/20">
                                      {message.content ||
                                        (message.id.startsWith('streaming-assistant-')
                                          ? t('assistants.thinkingPlaceholder')
                                          : '')}
                                      </div>
                                  </div>
                                  {(message.downloads ?? []).length > 0 ? (
                                    <div className="flex flex-wrap gap-2.5 px-1">
                                      {(message.downloads ?? []).map((download, downloadIndex) => (
                                        <a
                                          key={`${message.id}-${download.filename}-${downloadIndex}`}
                                          href={`/api/assistants/${assistantId}/downloads/${message.id}?index=${downloadIndex}`}
                                          download={download.filename}
                                          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-lowest px-4 py-2 text-[13px] font-semibold text-on-surface-variant shadow-sm transition-colors hover:border-primary/20 hover:bg-primary/8 hover:text-on-surface"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                          <span className="truncate">{download.filename}</span>
                                        </a>
                                      ))}
                                    </div>
                                  ) : null}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center">
                      <div className="w-full text-center">
                        <h2 className="mb-6 font-headline text-[clamp(2.4rem,6vw,4.4rem)] font-bold leading-[1.1] tracking-tight text-on-surface">
                          {t('assistants.goodMorning')}<br />
                          <span className="text-on-surface-variant/45">{t('assistants.howCanIHelp')}</span>
                        </h2>

                        <div className="mt-12 scale-110 sm:scale-100">
                          {renderComposer(true)}
                        </div>

                        {starterPrompts.length > 0 && (
                          <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
                             <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                               {t('assistants.startTask')}
                             </p>
                            {renderStarterPrompts(true)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Persistent Floating Input for Active Chats */}
            {hasMessages && (
                <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
                    <div className="h-40 bg-gradient-to-t from-background via-background/85 to-transparent pt-12" />
                    <div className="bg-background px-4 pb-8 pointer-events-auto sm:px-6 lg:px-12">
                        <div className="mx-auto w-full max-w-[880px]">
                            {renderComposer()}
                        </div>
                    </div>
                </div>
            )}
          </main>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.14);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
