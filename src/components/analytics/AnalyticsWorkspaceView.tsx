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

interface DashboardAnalyticsState {
  isLoading: boolean;
  isLoadingMore: boolean;
  isDetailLoading: boolean;
  data: DashboardAnalyticsResponse | null;
  selectedWidgetSessionId: string | null;
  selectedConversation: DashboardConversationDetailResponse | null;
}

const railItemClassName =
  "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200";
const fieldClassName =
  "h-10 w-full rounded-xl border border-outline-variant/15 bg-background px-3 text-sm text-on-surface outline-none transition-colors focus:border-on-surface/20";
const shellClassName =
  "overflow-hidden rounded-[1.8rem] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]";

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

function AnalyticsRail({
  activeView,
  onChange,
}: {
  activeView: AnalyticsView;
  onChange: (view: AnalyticsView) => void;
}) {
  const items: Array<{
    key: AnalyticsView;
    label: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      key: "chat",
      label: "Chat",
      description: "Inbox and transcripts",
      icon: MessageSquare,
    },
    {
      key: "analytics",
      label: "Analytics",
      description: "KPIs and overview",
      icon: BarChart3,
    },
  ];

  return (
    <aside className="flex h-full flex-col bg-background/70">
      <div className="border-b border-outline-variant/10 px-4 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant/55">
          Workspace view
        </p>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Switch between the live inbox and the broader analytics overview.
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-4 lg:py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeView;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`${railItemClassName} min-w-[13rem] text-left lg:min-w-0 ${
                isActive
                  ? "bg-[#FF6B52]/10 text-on-surface"
                  : "text-secondary hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              {isActive ? (
                <div className="absolute left-0 top-2.5 bottom-2.5 hidden w-0.5 rounded-full bg-[#FF6B52] lg:block" />
              ) : null}
              <Icon
                className={`h-[1.05rem] w-[1.05rem] shrink-0 ${
                  isActive
                    ? "text-[#FF6B52]"
                    : "text-on-surface-variant group-hover:text-on-surface"
                }`}
                strokeWidth={1.9}
              />
              <span className="min-w-0">
                <span className={`block text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-on-surface-variant">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
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
    <div className="border-b border-outline-variant/10 px-4 py-4 sm:px-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
            Chat
          </p>
          <h2 className="mt-2 text-lg font-semibold text-on-surface">Inbox</h2>
        </div>
        <span className="text-xs text-on-surface-variant/60">
          {(data?.conversations.length ?? 0)} sessions
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select
          value={filters.agentId ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              agentId: event.target.value || null,
            }))
          }
          className={fieldClassName}
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
          className={fieldClassName}
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
          className={fieldClassName}
          aria-label="Filter by range"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>

        <label className="relative block sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search agent or widget"
            className={`${fieldClassName} pl-10`}
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
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-on-surface/20 bg-surface-container"
          : "border-transparent bg-transparent hover:border-outline-variant/10 hover:bg-surface-container-low"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-on-surface">
            {conversation.agentLabel || conversation.agentName || "Unknown agent"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="truncate">{conversation.widgetName}</span>
            <span className="rounded-full border border-outline-variant/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/70">
              {conversation.source}
            </span>
            {conversation.hasLead ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Lead
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-on-surface-variant/60">
          {formatRelativeDate(conversation.lastActivityAt)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">
        {conversation.latestSnippet || "No customer-facing messages yet."}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-on-surface-variant/65">
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

  return (
    <section className="flex min-h-[32rem] flex-col bg-surface-container-lowest lg:h-full lg:min-h-0 lg:overflow-hidden">
      <InboxToolbar filters={filters} setFilters={setFilters} data={state.data} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
        {state.isLoading ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-surface-container-low"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-outline-variant/15 bg-background px-5 text-center">
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
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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

            {state.data?.pageInfo.hasMore ? (
              <div className="border-t border-outline-variant/10 px-1 pt-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={state.isLoadingMore}
                  className="w-full rounded-xl border border-outline-variant/15 bg-background px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  {state.isLoadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function DebugPanel({ trace }: { trace: DebugTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-on-surface/5"
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
        <div className="border-t border-outline-variant/10 p-3 text-[11px] font-mono leading-relaxed">
          {trace.hadError && trace.errorSummary ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-error/10 p-2 text-error">
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
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
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
    <section className="flex min-h-[32rem] flex-col bg-background lg:h-full lg:min-h-0">
      <div className="border-b border-outline-variant/10 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
              Conversation
            </p>
            <h2 className="mt-2 truncate text-2xl font-headline font-bold text-on-surface">
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
              className="rounded-full border border-outline-variant/10 px-3 py-2 text-xs font-semibold text-on-surface-variant"
            >
              Close
            </button>
          ) : null}
        </div>

        {detail ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Started {formatRelativeDate(detail.conversation.startedAt)}
            </span>
            <span className="rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Active {formatRelativeDate(detail.conversation.lastActivityAt)}
            </span>
            <span className="rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {detail.conversation.source}
            </span>
            {detail.lead ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Lead captured
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="h-20 animate-pulse rounded-2xl bg-surface-container-low" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={`h-24 animate-pulse rounded-2xl bg-surface-container-low ${
                index % 2 === 0 ? "ml-auto max-w-[78%]" : "max-w-[82%]"
              }`}
            />
          ))}
        </div>
      ) : !detail ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="max-w-md rounded-2xl border border-dashed border-outline-variant/15 bg-surface-container-low px-6 py-8 text-center">
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
            <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
                Transcript
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Customer and assistant messages for this session.
              </p>
            </div>
            <span className="text-xs text-on-surface-variant/60">
              {detail.transcript.length} messages
            </span>
          </div>

          {detail.transcript.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/15 bg-surface-container-low px-5 py-8 text-sm leading-7 text-on-surface-variant">
              No customer-facing messages stored for this session yet.
            </div>
          ) : (
            <div className="space-y-4">
              {detail.transcript.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-[1.4rem] px-4 py-4 ${
                    message.role === "user"
                      ? "ml-auto bg-[#79C3FF] text-[#062139]"
                      : "border border-outline-variant/10 bg-surface-container-low text-on-surface"
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
    <section className="min-h-[32rem] bg-surface-container-lowest lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="border-b border-outline-variant/10 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
          Analytics
        </p>
        <h2 className="mt-2 text-2xl font-headline font-bold text-on-surface">
          Workspace performance
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-on-surface-variant">
          Read the current signal across conversations, agents, widgets and connected apps.
        </p>
      </div>

      <div className="space-y-6 px-5 py-5">
        <div className="grid gap-4 md:grid-cols-3">
          {topMetrics.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-outline-variant/15 bg-background px-5 py-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
                {label}
              </p>
              <p className="mt-4 text-4xl font-headline font-bold text-on-surface">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {supportMetrics.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-outline-variant/15 bg-background px-5 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
                {label}
              </p>
              <p className="mt-3 text-2xl font-headline font-bold text-on-surface">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-background p-4">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
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
  const { workspace } = useAppContext();
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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Conversation operations
          </p>
          <h1 className="mt-3 text-[2.15rem] font-headline font-bold leading-tight tracking-tight text-on-surface sm:text-[2.45rem]">
            Analytics
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
            Separate live chat review from workspace analytics across {workspace.name}.
          </p>
        </div>
      </div>

      {activeView === "chat" ? (
        <div className={`${shellClassName} grid lg:h-[calc(100dvh-12rem)] lg:min-h-0 lg:grid-cols-[15rem_24rem_minmax(0,1fr)]`}>
          <div className="border-b border-outline-variant/10 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
            <AnalyticsRail activeView={activeView} onChange={setActiveView} />
          </div>
          <div className="border-b border-outline-variant/10 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
            <ConversationInboxPane
              state={state}
              filters={filters}
              setFilters={setFilters}
              onSelectConversation={handleSelectConversation}
              onLoadMore={() => void loadMore()}
            />
          </div>
          <div className="hidden lg:h-full lg:min-h-0 lg:block">
            <ConversationDetail
              detail={state.selectedConversation}
              isLoading={state.isDetailLoading}
            />
          </div>
        </div>
      ) : (
        <div className={`${shellClassName} grid lg:h-[calc(100dvh-12rem)] lg:min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]`}>
          <div className="border-b border-outline-variant/10 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
            <AnalyticsRail activeView={activeView} onChange={setActiveView} />
          </div>
          <AnalyticsOverview
            data={state.data}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
      )}

      {isMobileDetailOpen && activeView === "chat" ? (
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
