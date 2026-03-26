"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { formatRelativeDate } from "@/lib/utils";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsRange,
  DashboardAnalyticsResponse,
  DashboardConversationDetailResponse,
  DebugTrace,
} from "@/lib/types";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";

type AnalyticsView = "chat" | "analytics";

function AnalyticsTabs({
  activeView,
  onChange,
}: {
  activeView: AnalyticsView;
  onChange: (view: AnalyticsView) => void;
}) {
  const items: Array<{
    key: AnalyticsView;
    label: string;
    icon: LucideIcon;
  }> = [
    {
      key: "chat",
      label: "Chat",
      icon: MessageSquare,
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: BarChart3,
    },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-outline-variant/30 bg-surface-container-low p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeView;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
              isActive
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

interface DashboardAnalyticsState {
  isLoading: boolean;
  isLoadingMore: boolean;
  isDetailLoading: boolean;
  data: DashboardAnalyticsResponse | null;
  selectedWidgetSessionId: string | null;
  selectedConversation: DashboardConversationDetailResponse | null;
  detailCache: Record<string, DashboardConversationDetailResponse>;
}

const fieldClassName =
  "h-10 w-full rounded border bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container";

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

function InboxToolbar({
  filters,
  setFilters,
  data,
}: {
  filters: DashboardAnalyticsAppliedFilters;
  setFilters: Dispatch<SetStateAction<DashboardAnalyticsAppliedFilters>>;
  data: DashboardAnalyticsResponse | null;
}) {
  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-lowest p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-on-surface">Sessions inbox</h2>
        <span className="text-[11px] font-medium text-on-surface-variant">
          {(data?.conversations.length ?? 0)} sessions
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={filters.agentId ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              agentId: event.target.value || null,
            }))
          }
          className="h-9 rounded border border-outline-variant/20 bg-surface-container-low px-2 text-xs"
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          {(data?.filters.agents ?? []).map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <select
          value={filters.widgetId ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              widgetId: event.target.value || null,
            }))
          }
          className="h-9 rounded border border-outline-variant/20 bg-surface-container-low px-2 text-xs"
          aria-label="Filter by widget"
        >
          <option value="">All widgets</option>
          {(data?.filters.widgets ?? []).map((widget) => (
            <option key={widget.id} value={widget.id}>
              {widget.name}
            </option>
          ))}
        </select>
        <select
          value={filters.range}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              range: event.target.value as DashboardAnalyticsRange,
            }))
          }
          className="h-9 rounded border border-outline-variant/20 bg-surface-container-low px-2 text-xs"
          aria-label="Filter by range"
        >
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
        </select>
        <label className="relative block sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search sessions, agents, leads..."
            className="h-9 w-full rounded border border-outline-variant/20 bg-surface-container-low pl-8 pr-2 text-xs"
            aria-label="Search conversations"
          />
        </label>
      </div>
    </div>
  );
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
      type="button"
      onClick={onClick}
      className={`w-full border-b border-outline-variant/10 px-4 py-3 text-left transition-colors ${
        selected
          ? "border-l-4 border-l-primary-container bg-primary-container/10"
          : "hover:bg-surface-container-low"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-on-surface">
            {conversation.agentLabel || conversation.agentName || "Unknown agent"}
          </p>
          <p className="truncate text-[12px] text-on-surface-variant mt-0.5">
            {conversation.latestSnippet || "No messages yet"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-on-surface-variant">
            {formatRelativeDate(conversation.lastActivityAt)}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-on-surface-variant">
              {conversation.messageCount} msg
            </span>
            {conversation.hasLead && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-on-surface-variant">
        <span>{conversation.messageCount} messages</span>
        <span>{conversation.userMessageCount} user</span>
      </div>
    </button>
  );
}

function ConversationInboxPane({
  state,
  filters,
  setFilters,
  onSelectConversation,
  onLoadMore,
}: {
  state: DashboardAnalyticsState;
  filters: DashboardAnalyticsAppliedFilters;
  setFilters: Dispatch<SetStateAction<DashboardAnalyticsAppliedFilters>>;
  onSelectConversation: (widgetSessionId: string) => void;
  onLoadMore: () => void;
}) {
  const conversations = state.data?.conversations ?? [];
  const hasFilters = Boolean(
    filters.search || filters.widgetId || filters.agentId,
  );
  const hasMore = Boolean(state.data?.pageInfo.hasMore);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <InboxToolbar filters={filters} setFilters={setFilters} data={state.data} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {state.isLoading ? (
          <div className="flex-1 space-y-2 p-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse bg-surface-container-low rounded"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-base font-semibold text-on-surface">
                {hasFilters
                  ? "No conversations match these filters."
                  : "No widget conversations yet."}
              </p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                {hasFilters
                  ? "Try clearing one or more filters to widen the result set."
                  : "Once customers start chatting through your widgets, their sessions will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.widgetSessionId}
                conversation={conversation}
                selected={
                  conversation.widgetSessionId === state.selectedWidgetSessionId
                }
                onClick={() => onSelectConversation(conversation.widgetSessionId)}
              />
            ))}
          </div>
        )}

        {!state.isLoading && conversations.length > 0 ? (
          <div className="border-t border-outline-variant/10 p-3">
            <p className="mb-2 text-[11px] text-on-surface-variant">
              Showing {conversations.length} sessions
            </p>
            {hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={state.isLoadingMore}
                className="h-9 w-full rounded border border-outline-variant/20 bg-surface-container-low px-3 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.isLoadingMore ? "Loading more..." : "Load more sessions"}
              </button>
            ) : (
              <p className="text-xs text-on-surface-variant">
                You&apos;ve reached the end of this result set.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DebugPanel({ trace }: { trace: DebugTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded bg-surface-container-low text-on-surface-variant">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-container-high"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
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

      {expanded ? (
        <div className="p-3 text-[11px] font-mono leading-relaxed">
          {trace.hadError && trace.errorSummary ? (
            <div className="mb-3 flex items-start gap-2 rounded bg-error/10 p-2 text-error">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{trace.errorSummary}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            {trace.events.map((event, index) => {
              const isError =
                event.type.includes("error") || event.type === "session_miss";
              const isSuccess =
                event.type === "tool_result" ||
                event.type === "session_created" ||
                event.type === "knowledge_hit";

              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-12 shrink-0 text-right text-[10px] opacity-50">
                    +{event.ts}ms
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isError ? (
                        <AlertCircle className="h-3 w-3 shrink-0 text-error" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary-container" />
                      ) : (
                        <Activity className="h-3 w-3 shrink-0 opacity-50" />
                      )}
                      <span className={`font-semibold ${isError ? "text-error" : ""}`}>
                        {event.type}
                      </span>
                      {event.name ? (
                        <span className="truncate rounded bg-on-surface/5 px-1.5 opacity-70">
                          {event.name}
                        </span>
                      ) : null}
                    </div>

                    {event.error ? (
                      <div className="mt-1 whitespace-pre-wrap break-words pl-4.5 text-error">
                        {event.error}
                      </div>
                    ) : null}

                    {event.args ? (
                      <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words pl-4.5 opacity-70">
                        args: {JSON.stringify(event.args)}
                      </div>
                    ) : null}

                    {event.result ? (
                      <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words pl-4.5 opacity-70">
                        result:{" "}
                        {typeof event.result === "string"
                          ? event.result
                          : JSON.stringify(event.result)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
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
  const title =
    detail?.conversation.agentLabel ||
    detail?.conversation.agentName ||
    "Conversation detail";

  return (
    <section className="flex flex-col h-full bg-surface-container-lowest">
      <div className="px-6 py-5 border-b border-outline-variant/10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Conversation
            </p>
            <h2 className="mt-2 truncate text-[1.25rem] font-semibold text-on-surface">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {detail
                ? `${detail.conversation.widgetName} · ${detail.conversation.source}`
                : "Select a session from the inbox to inspect the transcript."}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
            >
              Close
            </button>
          ) : null}
        </div>

        {detail ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Started {formatRelativeDate(detail.conversation.startedAt)}
            </span>
            <span className="rounded bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Active {formatRelativeDate(detail.conversation.lastActivityAt)}
            </span>
            <span className="rounded bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {detail.conversation.source}
            </span>
            {detail.lead ? (
              <span className="rounded bg-primary-container/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-container">
                Lead captured
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="h-20 animate-pulse bg-surface-container-low" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={`h-24 animate-pulse bg-surface-container-low ${
                index % 2 === 0 ? "ml-auto max-w-[78%]" : "max-w-[82%]"
              }`}
            />
          ))}
        </div>
      ) : !detail ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="max-w-md bg-surface-container-low px-6 py-8 text-center">
            <p className="text-base font-semibold text-on-surface">
              No conversation selected yet.
            </p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              Select a session from the inbox to inspect the transcript.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {detail.lead ? (
            <div className="mb-5 bg-primary-container/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Lead
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-on-surface-variant">Name</p>
                  <p className="mt-1 text-sm font-medium text-on-surface">
                    {detail.lead.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Email</p>
                  <p className="mt-1 text-sm font-medium text-on-surface">
                    {detail.lead.email}
                  </p>
                </div>
                {detail.lead.phone ? (
                  <div>
                    <p className="text-xs text-on-surface-variant">Phone</p>
                    <p className="mt-1 text-sm font-medium text-on-surface">
                      {detail.lead.phone}
                    </p>
                  </div>
                ) : null}
                {detail.lead.message ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-on-surface-variant">Message</p>
                    <p className="mt-1 text-sm leading-6 text-on-surface">
                      {detail.lead.message}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Transcript
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Customer and assistant messages for this session.
              </p>
            </div>
            <span className="text-xs text-on-surface-variant">
              {detail.transcript.length} messages
            </span>
          </div>

          {detail.transcript.length === 0 ? (
            <div className="bg-surface-container-low px-5 py-8 text-sm leading-7 text-on-surface-variant">
              No customer-facing messages stored for this session yet.
            </div>
          ) : (
            <div className="space-y-3">
              {detail.transcript.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded px-4 py-4 ${
                    message.role === "user"
                      ? "ml-auto bg-primary-container text-white"
                      : "bg-surface-container-low text-on-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                      {message.role === "user" ? "User" : "Assistant"}
                    </p>
                    <p className="text-[11px] opacity-60">
                      {formatRelativeDate(message.createdAt)}
                    </p>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                    {message.content}
                  </p>

                  {message.role === "assistant" && message.debugTrace ? (
                    <DebugPanel trace={message.debugTrace} />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AnalyticsOverview({
  data,
  filters,
  setFilters,
}: {
  data: DashboardAnalyticsResponse | null;
  filters: DashboardAnalyticsAppliedFilters;
  setFilters: Dispatch<SetStateAction<DashboardAnalyticsAppliedFilters>>;
}) {
  const topMetrics = [
    ["Conversations", String(data?.overview.conversations ?? 0)],
    ["Messages", String(data?.overview.messages ?? 0)],
    ["Active Widgets", String(data?.overview.activeWidgets ?? 0)],
  ] as const;
  const supportMetrics = [
    ["Agents", String(data?.overview.agents ?? 0)],
    ["Connected Apps", String(data?.overview.connectedApps ?? 0)],
    ["Failures", String(data?.overview.failures ?? 0)],
  ] as const;

  return (
    <section className="flex flex-col h-full bg-surface-container-lowest overflow-y-auto">
      <div className="px-8 py-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[1.5rem] font-semibold text-on-surface">
              Workspace Performance
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">
              Track your conversations, agents, and widget performance
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 pt-0">
        <div className="grid gap-6 md:grid-cols-3">
          {topMetrics.map(([label, value]) => (
            <div
              key={label}
              className="bg-surface-container-low px-5 py-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                {label}
              </p>
              <p className="mt-4 text-4xl font-headline font-bold text-on-surface">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {supportMetrics.map(([label, value]) => (
            <div
              key={label}
              className="bg-surface-container-low px-6 py-6"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                {label}
              </p>
              <p className="mt-4 text-3xl font-semibold text-on-surface">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-surface-container-low p-6 mt-6">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Filters
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Narrow the analytics overview by period, widget, agent or search.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr]">
            <select
              value={filters.range}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  range: event.target.value as DashboardAnalyticsRange,
                }))
              }
              className={fieldClassName}
              aria-label="Filter analytics by range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <select
              value={filters.widgetId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  widgetId: event.target.value || null,
                }))
              }
              className={fieldClassName}
              aria-label="Filter analytics by widget"
            >
              <option value="">All widgets</option>
              {(data?.filters.widgets ?? []).map((widget) => (
                <option key={widget.id} value={widget.id}>
                  {widget.name}
                </option>
              ))}
            </select>

            <select
              value={filters.agentId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  agentId: event.target.value || null,
                }))
              }
              className={fieldClassName}
              aria-label="Filter analytics by agent"
            >
              <option value="">All agents</option>
              {(data?.filters.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>

            <label className="relative block lg:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search widget or agent"
                className={`${fieldClassName} pl-10`}
                aria-label="Search analytics"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsWorkspaceView() {
  const { showToast } = useToast();
  const [activeView, setActiveView] = useState<AnalyticsView>("chat");
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
    detailCache: {},
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
          detailCache: {},
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
      const sessionId = state.selectedWidgetSessionId;
      if (!sessionId) {
        return;
      }

      const cachedDetail = state.detailCache[sessionId];
      if (cachedDetail) {
        setState((current) => ({
          ...current,
          isDetailLoading: false,
          selectedConversation: cachedDetail,
        }));
        return;
      }

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
          `/api/dashboard/analytics/conversations/${sessionId}`,
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
          detailCache: {
            ...current.detailCache,
            [sessionId]: payload as DashboardConversationDetailResponse,
          },
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
  }, [showToast, state.detailCache, state.selectedWidgetSessionId]);

  useEffect(() => {
    if (activeView !== "chat") {
      setIsMobileDetailOpen(false);
    }
  }, [activeView]);

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

  const handleSelectConversation = (widgetSessionId: string) => {
    setState((current) => ({
      ...current,
      selectedWidgetSessionId: widgetSessionId,
    }));

    if (window.matchMedia("(max-width: 1023px)").matches) {
      setIsMobileDetailOpen(true);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1720px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            Workspace insights
          </p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-tight text-on-surface">
            Analytics
          </h1>
        </div>
        <AnalyticsTabs activeView={activeView} onChange={setActiveView} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[1.6rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {activeView === "chat" ? (
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.65fr)] lg:gap-4 lg:p-4">
            <div className="min-h-0 overflow-hidden rounded-[1.2rem] border border-outline-variant/20">
              <ConversationInboxPane
                state={state}
                filters={filters}
                setFilters={setFilters}
                onSelectConversation={handleSelectConversation}
                onLoadMore={() => void loadMore()}
              />
            </div>
            <div className="hidden min-h-0 overflow-hidden rounded-[1.2rem] border border-outline-variant/20 lg:block">
              <ConversationDetail
                detail={state.selectedConversation}
                isLoading={state.isDetailLoading}
              />
            </div>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-hidden">
            <AnalyticsOverview
              data={state.data}
              filters={filters}
              setFilters={setFilters}
            />
          </div>
        )}
      </div>

      {isMobileDetailOpen && activeView === "chat" ? (
        <div className="fixed inset-0 z-50 bg-surface-container-lowest/85 p-4 backdrop-blur-sm lg:hidden">
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
