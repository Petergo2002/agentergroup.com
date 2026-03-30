'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { useToast } from '@/components/ui/ToastProvider';
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

  const loadAssistant = useCallback(
    async (threadId?: string | null) => {
      const search = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
      const response = await fetch(`/api/assistants/${assistantId}${search}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Failed to load assistant.');
      }

      setDetail(payload as AssistantDetailResponse);
      return payload as AssistantDetailResponse;
    },
    [assistantId],
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
          error instanceof Error ? error.message : 'Failed to load assistant.',
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
  }, [loadAssistant, showToast]);

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
        throw new Error(payload?.error || 'Failed to create a new chat.');
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
        error instanceof Error ? error.message : 'Failed to create a new chat.',
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
        error instanceof Error ? error.message : 'Failed to load chat.',
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

    if (!content || isPaused) {
      return;
    }

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
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.threadId) {
        throw new Error(payload?.error || 'Failed to send the message.');
      }

      await loadAssistant(payload.threadId);
      setIsMobileThreadsOpen(false);
    } catch (error) {
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
      showToast(
        error instanceof Error ? error.message : 'Failed to send the message.',
        'error',
      );
    } finally {
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
        throw new Error(payload?.error || 'Failed to rename chat.');
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
        error instanceof Error ? error.message : 'Failed to rename chat.',
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
              ? 'border-slate-200 bg-[#F16B2E] text-white shadow-[0_8px_16px_rgba(241,107,46,0.2)]'
              : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600'
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
        className={`w-full max-w-full group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#F16B2E]/20 ${
          isActive
            ? 'border-slate-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]'
            : 'border-transparent bg-transparent hover:bg-slate-50'
        }`}
      >
        <div className="flex min-w-0 max-w-full items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wider ${
              isActive
                ? 'bg-[#F16B2E] text-white'
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
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
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-900 outline-none ring-0 focus:border-[#F16B2E]/40"
                  />
                  <button
                    type="button"
                    aria-label="Save chat title"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRenameThread(thread.id);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <p className={`truncate text-[13px] font-semibold transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                    {thread.title}
                  </p>
                  <button
                    type="button"
                    aria-label="Rename chat"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStartThreadRename(thread);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-relaxed transition-colors ${isActive ? 'text-slate-500' : 'text-slate-400 group-hover:text-slate-500'}`}>
              {thread.lastMessageSnippet || 'New conversation...'}
            </p>
          </div>
        </div>
        {isActive && (
          <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#F16B2E]" />
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-600 shadow-sm transition-all hover:border-[#F16B2E]/30 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
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
        className={`relative overflow-hidden rounded-[2rem] bg-slate-50 border border-slate-100/50 backdrop-blur-3xl transition-all duration-300 focus-within:bg-white focus-within:border-slate-200 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]`}
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
                className={`w-full resize-none appearance-none border-0 bg-transparent p-0 text-[15px] leading-[1.6] text-slate-900 outline-none ring-0 shadow-none placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none ${
                  hero ? 'min-h-[60px]' : 'min-h-[44px] max-h-48'
                }`}
                style={{ boxShadow: 'none' }}
                placeholder={
                  isPaused
                    ? 'This assistant is paused...'
                    : isDeepThinking 
                    ? 'Thinking deeply... ask anything'
                    : `Message ${detail?.assistant.name ?? 'your assistant'}...`
              }
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-3 pt-2">
            <div className="flex items-center gap-1.5">
               <button 
                type="button" 
                onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                className={`flex h-9 px-3 items-center gap-2 rounded-full text-[12px] font-medium transition-all ${
                  isAttachmentOpen ? 'bg-[#F16B2E]/15 text-[#F16B2E]' : 'text-slate-500 hover:bg-slate-200/60'
                }`}
               >
                <Paperclip className="h-4 w-4" />
                <span>Attach</span>
               </button>
               <button 
                type="button" 
                onClick={() => setIsDeepThinking(!isDeepThinking)}
                className={`flex h-9 px-3 items-center gap-2 rounded-full text-[12px] font-medium transition-all ${
                  isDeepThinking ? 'bg-[#F16B2E]/15 text-[#F16B2E]' : 'text-slate-500 hover:bg-slate-200/60'
                }`}
               >
                <Brain className="h-4 w-4" />
                <span>Deep Thinking</span>
               </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSendMessage(draftMessage)}
              disabled={isSending || isPaused || !draftMessage.trim()}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
                draftMessage.trim() 
                  ? 'bg-[#F16B2E] text-white shadow-[0_4px_12px_rgba(241,107,46,0.3)]' 
                  : 'bg-slate-200 text-slate-400'
              } disabled:cursor-not-allowed`}
            >
              {isSending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {hero && (
        <div className="mt-6 flex items-center justify-center gap-6">
             <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                <div className="h-1.5 w-1.5 rounded-full bg-[#F16B2E]" />
                24/7 Support
             </div>
             <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                Privacy Protection
             </div>
             <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                AI Powered
             </div>
        </div>
      )}
    </div>
  );

  const renderExpandedRail = (mobile = false) => (
      <div className="flex h-full min-h-0 min-w-0 overflow-hidden flex-col bg-transparent">
      <div className="flex items-center justify-between gap-4 px-5 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
          History
        </p>
        <button
          type="button"
          onClick={() =>
            mobile ? setIsMobileThreadsOpen(false) : setIsThreadRailCollapsed(true)
          }
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600"
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
                className="h-16 animate-pulse rounded-2xl bg-white/5"
              />
            ))}
          </div>
        ) : detail && detail.threads.length > 0 ? (
          <div className="min-w-0 space-y-1 overflow-hidden">
            {detail.threads.map((thread) => renderThreadItem(thread))}
          </div>
        ) : (
          <div className="mx-2 mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold text-slate-400">No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-white text-slate-900 selection:bg-[#F16B2E]/20">
      {/* Immersive Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-slate-100 blur-[130px]" />
        <div className="absolute -right-[15%] top-[10%] h-[50%] w-[50%] rounded-full bg-violet-100 blur-[120px]" />
        <div className="absolute left-[30%] top-[40%] h-[40%] w-[40%] rounded-full bg-blue-50/50 blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white/80 to-slate-50/50" />
      </div>

      <div className="relative z-10 flex h-full flex-col overflow-hidden">
        {/* Simplified Header */}
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/70 backdrop-blur-3xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-4">
               <button
                  type="button"
                  onClick={() => setIsMobileThreadsOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 lg:hidden"
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>

                <Link
                  href="/assistants"
                  className="group flex h-10 items-center gap-2 rounded-xl bg-white pl-3 pr-4 text-[13px] font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 border border-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Explore</span>
                </Link>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <div className="flex items-center gap-3">
                    <div className="hidden sm:block">
                        <h1 className="max-w-[30rem] truncate text-[14px] font-bold tracking-tight text-slate-900">
                          {activeThread?.title ?? detail?.assistant.name ?? 'Agent'}
                        </h1>
                        {activeThread ? (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                            {detail?.assistant.name ?? 'Agent'}
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
                    className="flex h-10 px-4 items-center gap-2 rounded-xl bg-[#F16B2E] text-white text-[13px] font-bold transition-all hover:bg-[#d95d25] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-[0_8px_16px_rgba(241,107,46,0.2)]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                    <span>New Chat</span>
                  </button>
                  <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-600">
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
          className={`fixed inset-y-0 left-0 z-50 w-[18rem] overflow-hidden bg-white border-r border-slate-100 shadow-2xl transition-transform duration-400 ease-out lg:hidden ${
            isMobileThreadsOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderExpandedRail(true)}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <aside
            className={`hidden overflow-hidden border-r border-slate-100 bg-slate-50/30 backdrop-blur-3xl transition-all duration-500 ease-in-out lg:flex lg:shrink-0 ${
              isThreadRailCollapsed ? 'w-[72px]' : 'w-[280px]'
            }`}
          >
            {isThreadRailCollapsed ? (
              <div className="flex h-full w-full flex-col items-center gap-4 py-6">
                <button
                  type="button"
                  onClick={() => setIsThreadRailCollapsed(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="h-px w-6 bg-slate-200" />
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
                    <div className="mb-8 rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-[13px] font-medium text-slate-600 text-center backdrop-blur-md">
                      Chat is currently paused. New messages are disabled.
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
                              <div className="w-full max-w-[40rem] rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur-sm">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F16B2E]/12 text-[#F16B2E]">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#F16B2E]">
                                      PDF Ready
                                    </p>
                                    <p className="mt-1 text-[15px] font-semibold text-slate-900">
                                      {message.content}
                                    </p>
                                    <p className="mt-1 text-[12px] text-slate-400">
                                      {formatRelativeDate(message.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2.5">
                                  {(message.downloads ?? []).map((download, downloadIndex) => (
                                    <a
                                      key={`${message.id}-${download.url}-${downloadIndex}`}
                                      href={`/api/assistants/${assistantId}/downloads/${message.id}?index=${downloadIndex}`}
                                      download={download.filename}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#F16B2E]/30 hover:bg-[#F16B2E]/5 hover:text-slate-900"
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
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                          {message.senderName || (message.role === 'assistant' ? (detail?.assistant.name ?? 'Agent') : 'You')}
                                       </span>
                                       <span className="text-[10px] text-slate-300">
                                          {formatRelativeDate(message.createdAt)}
                                       </span>
                                  </div>
                                  <div
                                      className={`relative px-6 py-5 text-[15px] font-medium leading-[1.75] shadow-sm ${
                                      message.role === 'assistant'
                                          ? 'rounded-[1.4rem] rounded-tl-sm border border-slate-100 bg-slate-50/50 text-slate-800 backdrop-blur-sm'
                                          : 'rounded-[1.4rem] rounded-tr-sm bg-[#F16B2E] text-white shadow-[0_8px_16px_-4px_rgba(241,107,46,0.2)]'
                                      }`}
                                  >
                                      <div className="whitespace-pre-wrap selection:bg-white/20">
                                      {message.content}
                                      </div>
                                  </div>
                                  {(message.downloads ?? []).length > 0 ? (
                                    <div className="flex flex-wrap gap-2.5 px-1">
                                      {(message.downloads ?? []).map((download, downloadIndex) => (
                                        <a
                                          key={`${message.id}-${download.filename}-${downloadIndex}`}
                                          href={`/api/assistants/${assistantId}/downloads/${message.id}?index=${downloadIndex}`}
                                          download={download.filename}
                                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#F16B2E]/30 hover:bg-[#F16B2E]/5 hover:text-slate-900"
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
                        <h2 className="font-headline text-[clamp(2.4rem,6vw,4.4rem)] font-bold leading-[1.1] tracking-tight text-slate-900 mb-6">
                          Good morning.<br />
                          <span className="text-slate-300">How can I help you?</span>
                        </h2>

                        <div className="mt-12 scale-110 sm:scale-100">
                          {renderComposer(true)}
                        </div>

                        {starterPrompts.length > 0 && (
                          <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
                             <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                               Start a task
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
                    <div className="h-40 bg-gradient-to-t from-white via-white/80 to-transparent pt-12" />
                    <div className="bg-white px-4 pb-8 sm:px-6 lg:px-12 pointer-events-auto">
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
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
