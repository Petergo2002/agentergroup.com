"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { useAppContext } from "@/components/app/AppContext";
import { formatRelativeDate } from "@/lib/utils";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsRange,
  DashboardAnalyticsResponse,
  DashboardConversationDetailResponse,
  DebugTrace,
} from "@/lib/types";
import { ChevronDown, ChevronRight, Bug, Clock, Activity, AlertCircle, CheckCircle2 } from "lucide-react";

interface DashboardAnalyticsState {
  isLoading: boolean;
  isLoadingMore: boolean;
  isDetailLoading: boolean;
  data: DashboardAnalyticsResponse | null;
  selectedWidgetSessionId: string | null;
  selectedConversation: DashboardConversationDetailResponse | null;
}

const analyticsCardClassName =
  "rounded-[1.6rem] border border-outline-variant/35 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]";

function buildAnalyticsUrl(
  filters: DashboardAnalyticsAppliedFilters,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  params.set("range", filters.range);

  if (filters.widgetId) {
    params.set("widgetId", filters.widgetId);
  }

  if (filters.agentId) {
    params.set("agentId", filters.agentId);
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  return `/api/dashboard/analytics?${params.toString()}`;
}

function ConversationRow({
  conversation,
  selected,
  onClick,
}: {
  conversation: DashboardAnalyticsConversationListItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all ${
        selected
          ? "border-on-surface/20 bg-surface-container shadow-sm"
          : "border-outline-variant/10 bg-background hover:border-outline-variant/20 hover:bg-surface-container-low"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-on-surface">
              {conversation.widgetName}
            </p>
            <span className="rounded-full border border-outline-variant/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
              {conversation.source}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-on-surface-variant/60">
            {conversation.agentLabel || conversation.agentName || "Unknown agent"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-on-surface-variant/60">
            {formatRelativeDate(conversation.lastActivityAt)}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/50">
            {conversation.messageCount} messages
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">
        {conversation.latestSnippet || "No customer-facing messages yet."}
      </p>

      <div className="mt-3 text-[11px] text-on-surface-variant/60">
        <span className="font-medium">{conversation.userMessageCount} user messages</span>
      </div>
    </button>
  );
}

function DebugPanel({ trace }: { trace: DebugTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-on-surface/5"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span>Debug Trace</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider opacity-70">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(trace.durationMs / 1000).toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {trace.iterationsUsed} iter
          </span>
          <span className="flex items-center gap-1">
            <Bug className="h-3 w-3" />
            {trace.events.length} events
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-outline-variant/10 p-3 text-[11px] font-mono leading-relaxed">
          {trace.hadError && trace.errorSummary && (
            <div className="mb-3 flex items-start gap-2 rounded bg-error/10 p-2 text-error">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{trace.errorSummary}</span>
            </div>
          )}
          
          <div className="space-y-2">
            {trace.events.map((event, i) => {
              const isError = event.type.includes("error") || event.type === "session_miss";
              const isSuccess = event.type === "tool_result" || event.type === "session_created" || event.type === "knowledge_hit";
              
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-12 shrink-0 text-right opacity-50 text-[10px]">
                    +{event.ts}ms
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isError ? (
                        <AlertCircle className="h-3 w-3 text-error shrink-0" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <Activity className="h-3 w-3 opacity-50 shrink-0" />
                      )}
                      <span className={`font-semibold ${isError ? "text-error" : ""}`}>
                        {event.type}
                      </span>
                      {event.name && (
                        <span className="truncate opacity-70 px-1.5 rounded bg-on-surface/5">
                          {event.name}
                        </span>
                      )}
                    </div>
                    
                    {event.error && (
                      <div className="mt-1 pl-4.5 text-error whitespace-pre-wrap break-words">
                        {event.error}
                      </div>
                    )}
                    
                    {event.args && (
                      <div className="mt-1 pl-4.5 opacity-70 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        args: {JSON.stringify(event.args)}
                      </div>
                    )}
                    
                    {!!event.result && (
                      <div className="mt-1 pl-4.5 opacity-70 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        result: {typeof event.result === 'string' ? event.result : JSON.stringify(event.result)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetail({
  detail,
  isLoading,
  onClose,
}: {
  detail: DashboardConversationDetailResponse | null;
  isLoading: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:flex lg:max-h-[calc(100dvh-18rem)] lg:flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
            Conversation
          </p>
          <h2 className="mt-3 text-xl font-headline font-bold text-on-surface">
            {detail?.conversation.widgetName || "Conversation detail"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {detail
              ? detail.conversation.agentLabel ||
                detail.conversation.agentName ||
                "Unknown agent"
              : "Select a conversation to inspect the transcript."}
          </p>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-full border border-outline-variant/10 px-3 py-2 text-xs font-semibold text-on-surface-variant"
          >
            Close
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-surface-container-low"
            />
          ))}
        </div>
      ) : !detail ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-5 py-6 text-sm leading-7 text-on-surface-variant lg:min-h-0 lg:flex-1">
          No conversation selected yet.
        </div>
      ) : (
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="rounded-full border border-outline-variant/10 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {detail.conversation.source}
            </span>
            <span className="rounded-full border border-outline-variant/10 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Started {formatRelativeDate(detail.conversation.startedAt)}
            </span>
            <span className="rounded-full border border-outline-variant/10 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Active {formatRelativeDate(detail.conversation.lastActivityAt)}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
              Transcript
            </p>
            <div className="mt-4 space-y-3">
              {detail.transcript.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-5 py-6 text-sm leading-7 text-on-surface-variant">
                  No customer-facing messages stored for this session yet.
                </div>
              ) : (
                detail.transcript.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[92%] rounded-[1.6rem] px-4 py-3 ${
                      message.role === "user"
                        ? "ml-auto bg-on-surface text-background"
                        : "border border-outline-variant/10 bg-background text-on-surface"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                      {message.role === "user" ? "User" : "Assistant"}
                    </p>
                    <p className="border-b border-outline-variant/10 pb-3 mt-2 whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                    
                    {message.role === "assistant" && message.debugTrace && (
                      <DebugPanel trace={message.debugTrace} />
                    )}
                    
                    <p className="mt-3 text-[11px] opacity-60">
                      {formatRelativeDate(message.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsWorkspaceView() {
  const { workspace } = useAppContext();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<DashboardAnalyticsAppliedFilters>({
    range: "30d",
    widgetId: null,
    agentId: null,
    search: "",
  });
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      search: deferredSearch,
    }),
    [deferredSearch, filters],
  );
  const [state, setState] = useState<DashboardAnalyticsState>({
    isLoading: true,
    isLoadingMore: false,
    isDetailLoading: false,
    data: null,
    selectedWidgetSessionId: null,
    selectedConversation: null,
  });
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      setState((current) => ({
        ...current,
        isLoading: true,
      }));

      try {
        const response = await fetch(buildAnalyticsUrl(effectiveFilters), {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Failed to load analytics.");
        }

        if (!isMounted) {
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          data: payload as DashboardAnalyticsResponse,
        }));
      } catch (error) {
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        showToast(
          error instanceof Error ? error.message : "Failed to load analytics.",
          "error",
        );
        setState((current) => ({
          ...current,
          isLoading: false,
          data: null,
          selectedWidgetSessionId: null,
          selectedConversation: null,
        }));
      }
    };

    void load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [effectiveFilters, showToast]);

  useEffect(() => {
    const conversations = state.data?.conversations ?? [];

    if (conversations.length === 0) {
      setState((current) => ({
        ...current,
        selectedWidgetSessionId: null,
        selectedConversation: null,
      }));
      setIsMobileDetailOpen(false);
      return;
    }

    const selectionStillExists = conversations.some(
      (conversation) => conversation.widgetSessionId === state.selectedWidgetSessionId,
    );

    if (!selectionStillExists) {
      setState((current) => ({
        ...current,
        selectedWidgetSessionId: conversations[0].widgetSessionId,
      }));
    }
  }, [state.data?.conversations, state.selectedWidgetSessionId]);

  useEffect(() => {
    if (!state.selectedWidgetSessionId) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadDetail = async () => {
      setState((current) => ({
        ...current,
        isDetailLoading: true,
        selectedConversation:
          current.selectedConversation?.conversation.widgetSessionId ===
          state.selectedWidgetSessionId
            ? current.selectedConversation
            : null,
      }));

      try {
        const response = await fetch(
          `/api/dashboard/analytics/conversations/${state.selectedWidgetSessionId}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Failed to load conversation detail.");
        }

        if (!isMounted) {
          return;
        }

        setState((current) => ({
          ...current,
          isDetailLoading: false,
          selectedConversation: payload as DashboardConversationDetailResponse,
        }));
      } catch (error) {
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : "Failed to load conversation detail.",
          "error",
        );
        setState((current) => ({
          ...current,
          isDetailLoading: false,
          selectedConversation: null,
        }));
      }
    };

    void loadDetail();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showToast, state.selectedWidgetSessionId]);

  const loadMore = async () => {
    if (!state.data?.pageInfo.nextCursor) {
      return;
    }

    setState((current) => ({
      ...current,
      isLoadingMore: true,
    }));

    try {
      const response = await fetch(
        buildAnalyticsUrl(effectiveFilters, state.data.pageInfo.nextCursor),
        {
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Failed to load more conversations.");
      }

      setState((current) => {
        const previous = current.data;
        const next = payload as DashboardAnalyticsResponse;

        if (!previous) {
          return {
            ...current,
            isLoadingMore: false,
            data: next,
          };
        }

        const existingIds = new Set(
          previous.conversations.map((conversation) => conversation.widgetSessionId),
        );
        const appended = next.conversations.filter(
          (conversation) => !existingIds.has(conversation.widgetSessionId),
        );

        return {
          ...current,
          isLoadingMore: false,
          data: {
            ...next,
            conversations: [...previous.conversations, ...appended],
          },
        };
      });
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load more conversations.",
        "error",
      );
      setState((current) => ({
        ...current,
        isLoadingMore: false,
      }));
    }
  };

  const summaryCards = [
    ["Conversations", String(state.data?.overview.conversations ?? 0)],
    ["Messages", String(state.data?.overview.messages ?? 0)],
    ["Active Widgets", String(state.data?.overview.activeWidgets ?? 0)],
  ] as const;
  const supportCards = [
    ["Agents", String(state.data?.overview.agents ?? 0)],
    ["Connected Apps", String(state.data?.overview.connectedApps ?? 0)],
    ["Failures", String(state.data?.overview.failures ?? 0)],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Conversation inbox
          </p>
          <h1 className="mt-3 text-[2.15rem] font-headline font-bold leading-tight tracking-tight text-on-surface sm:text-[2.45rem]">
            Analytics
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
            Review customer conversations and live widget activity across {workspace.name}.
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <div key={label} className={analyticsCardClassName}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/65">
              {label}
            </p>
            <p className="mt-5 text-4xl font-headline font-bold text-on-surface">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {supportCards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[1.35rem] border border-outline-variant/25 bg-surface-container-lowest px-5 py-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
              {label}
            </p>
            <p className="mt-3 text-2xl font-headline font-bold text-on-surface">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/65">
            Filters
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Narrow the inbox by time window, widget, or specialist.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[160px_1fr_1fr]">
          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
              Range
            </span>
            <select
              value={filters.range}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  range: event.target.value as DashboardAnalyticsRange,
                }))
              }
              className="w-full rounded-2xl border border-outline-variant/15 bg-background px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
              Widget
            </span>
            <select
              value={filters.widgetId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  widgetId: event.target.value || null,
                }))
              }
              className="w-full rounded-2xl border border-outline-variant/15 bg-background px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option value="">All widgets</option>
              {(state.data?.filters.widgets ?? []).map((widget) => (
                <option key={widget.id} value={widget.id}>
                  {widget.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
              Agent
            </span>
            <select
              value={filters.agentId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  agentId: event.target.value || null,
                }))
              }
              className="w-full rounded-2xl border border-outline-variant/15 bg-background px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option value="">All specialists</option>
              {(state.data?.filters.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
              Search
            </span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search widget or agent"
              className="w-full rounded-2xl border border-outline-variant/15 bg-background px-4 py-3 text-sm text-on-surface outline-none"
            />
          </label>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/65">
              Inbox
            </p>
            <h2 className="mt-3 text-xl font-headline font-bold text-on-surface">
              Conversations
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Public widget sessions only.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5 lg:flex lg:h-[calc(100dvh-18rem)] lg:flex-col">
            {state.isLoading ? (
              <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[1.5rem] bg-surface-container-low"
                  />
                ))}
              </div>
            ) : (state.data?.conversations.length ?? 0) === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-5 py-10 text-center">
                <p className="text-lg font-semibold text-on-surface">
                  {filters.search || filters.widgetId || filters.agentId
                    ? "No conversations match these filters."
                    : "No widget conversations yet."}
                </p>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                  {filters.search || filters.widgetId || filters.agentId
                    ? "Try clearing one or more filters to widen the result set."
                    : "Once customers start chatting through your widgets, their conversations will show up here."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                  {(state.data?.conversations ?? []).map((conversation) => (
                    <ConversationRow
                      key={conversation.widgetSessionId}
                      conversation={conversation}
                      selected={
                        conversation.widgetSessionId === state.selectedWidgetSessionId
                      }
                      onClick={() => {
                        setState((current) => ({
                          ...current,
                          selectedWidgetSessionId: conversation.widgetSessionId,
                        }));
                        setIsMobileDetailOpen(true);
                      }}
                    />
                  ))}
                </div>

                {state.data?.pageInfo.hasMore ? (
                  <div className="mt-5 lg:border-t lg:border-outline-variant/10 lg:pt-4">
                    <button
                      onClick={() => void loadMore()}
                      disabled={state.isLoadingMore}
                      className="w-full rounded-full border border-outline-variant/15 bg-background px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                    >
                      {state.isLoadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <ConversationDetail
            detail={state.selectedConversation}
            isLoading={state.isDetailLoading}
          />
        </div>
      </section>

      {isMobileDetailOpen ? (
        <div className="fixed inset-0 z-50 bg-background/85 p-4 backdrop-blur-sm lg:hidden">
          <div className="h-full overflow-y-auto">
            <ConversationDetail
              detail={state.selectedConversation}
              isLoading={state.isDetailLoading}
              onClose={() => setIsMobileDetailOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
