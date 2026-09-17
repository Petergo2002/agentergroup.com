"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { useAppContext } from "@/components/app/AppContext";
import { useToast } from "@/components/ui/ToastProvider";
import { LeadAiSummaryCard } from "@/components/leads/LeadAiSummaryCard";
import { hasAutomationsEnabled } from "@/lib/assistants/feature-flags";
import { jsonFetcher, workspaceSWRKey } from "@/lib/json-fetcher";
import { formatRelativeDate } from "@/lib/utils";
import { formatLocaleDate, formatLocaleNumber } from "@/lib/i18n";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAutomationTrendPoint,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsResponse,
  DashboardConversationDetailResponse,
  DebugTrace,
  LeadConversationSummary,
} from "@/lib/types";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  Bug,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  MessagesSquare,
  Paperclip,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface AnalyticsIdentitySummary {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface ConversationAttachment {
  type?: string;
  url: string;
  name: string;
}

function readConversationAttachments(
  metadata: Record<string, unknown> | null | undefined,
) {
  const attachments = metadata?.attachments;

  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.flatMap((attachment): ConversationAttachment[] => {
    if (
      !attachment ||
      typeof attachment !== "object" ||
      !("url" in attachment) ||
      !("name" in attachment) ||
      typeof attachment.url !== "string" ||
      typeof attachment.name !== "string"
    ) {
      return [];
    }

    return [{
      url: attachment.url,
      name: attachment.name,
      type:
        "type" in attachment && typeof attachment.type === "string"
          ? attachment.type
          : undefined,
    }];
  });
}

function resolveIdentityDisplay(
  identity: AnalyticsIdentitySummary | null,
  anonymousLabel: string,
  fallbackContext?: string | null,
) {
  const primary = identity?.name || identity?.email || anonymousLabel;
  const secondary =
    identity?.name && identity.email
      ? identity.email
      : fallbackContext ?? null;
  const initials = (identity?.name?.[0] || identity?.email?.[0] || "U").toUpperCase();

  return {
    primary,
    secondary,
    initials,
  };
}

function resolvePresenceDisplay(
  presenceStatus: DashboardAnalyticsConversationListItem["presenceStatus"],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (presenceStatus === "live") {
    return {
      label: t("analytics.live"),
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
      dotClassName: "bg-emerald-500",
      isLive: true,
    };
  }

  if (presenceStatus === "completed") {
    return {
      label: t("analytics.completed"),
      className: "bg-surface-container-low text-on-surface-variant/70 ring-outline-variant/15",
      dotClassName: "bg-outline-variant/50",
    };
  }

  return {
    label: t("analytics.idle"),
    className: "bg-surface-container text-on-surface-variant ring-outline-variant/15",
    dotClassName: "bg-on-surface-variant/45",
  };
}

function ConversationAttachments({
  attachments,
  alignEnd,
}: {
  attachments: ConversationAttachment[];
  alignEnd: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 flex flex-wrap gap-2 ${alignEnd ? "justify-end" : ""}`}>
      {attachments.map((attachment) => (
        attachment.type?.startsWith("image/") ? (
          <a
            key={`${attachment.url}:${attachment.name}`}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* Conversation attachments are runtime upload URLs, so keep a plain image element here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url}
              alt={attachment.name}
              className="h-24 w-24 rounded-lg border border-black/10 object-cover shadow-sm"
              loading="lazy"
              decoding="async"
            />
          </a>
        ) : (
          <a
            key={`${attachment.url}:${attachment.name}`}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-black/20"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-w-[120px] truncate">{attachment.name}</span>
          </a>
        )
      ))}
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

type AnalyticsStatItem = {
  key: string;
  label: string;
  value: ReactNode;
  meta: string;
  icon: LucideIcon;
  tone?: "brand" | "success" | "error";
  /** Daily series for this metric, server-aggregated over the filtered set. */
  sparkline?: number[];
};

/**
 * Shape-only trend for a stat tile.
 *
 * No axes or labels by design: the tile already carries the number, and this
 * only has to answer "rising or falling". The exact per-day values live in the
 * tooltip-bearing charts, not here.
 */
function StatSparkline({ series }: { series: number[] }) {
  if (series.length < 2) {
    return null;
  }

  const max = Math.max(...series, 1);
  const width = 64;
  const height = 20;
  const step = width / (series.length - 1);
  const points = series
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-5 w-16 shrink-0 overflow-visible text-primary"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function buildAnalyticsUrl(
  filters: DashboardAnalyticsAppliedFilters,
  cursor?: string,
) {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  if (filters.widgetId) params.set("widgetId", filters.widgetId);
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.automationStatus !== "all") {
    params.set("automationStatus", filters.automationStatus);
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.sessionStatus !== "all") params.set("sessionStatus", filters.sessionStatus);
  if (cursor) params.set("cursor", cursor);
  return `/api/dashboard/analytics?${params.toString()}`;
}

function DebugPanel({ trace }: { trace: DebugTrace }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
      >
        <div className="flex items-center gap-2">
          <Bug className="h-3 w-3" />
          <span>{t("analytics.executionContext")} - {trace.durationMs}ms</span>
        </div>
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="bg-surface-container-lowest p-3">
          <div className="space-y-3">
            {trace.events.map((event, index) => {
              const isAction = event.type === "tool_call" || event.type === "knowledge_hit";
              const Icon = isAction ? Activity : AlertCircle;
              
              const label = (() => {
                switch (event.type) {
                  case "tool_call": return t("analytics.toolCall", { name: event.name ?? t("common.unknown") });
                  case "tool_result": return t("analytics.toolSuccess", { name: event.name ?? t("common.unknown") });
                  case "tool_error": return t("analytics.toolError", { name: event.name ?? t("common.unknown") });
                  case "knowledge_hit": return t("analytics.knowledgeRetrievalMatch");
                  case "session_created": return t("analytics.sessionInitialized");
                  default: return event.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                }
              })();

              return (
                <div key={index} className="flex gap-3">
                  <div className="mt-0.5 shrink-0 rounded-full bg-surface-container-high p-1">
                    <Icon className="h-3 w-3 text-on-surface-variant" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-on-surface">
                        {label}
                      </p>
                      <span className="text-xs font-medium text-on-surface-variant/50">+{event.ts}ms</span>
                    </div>
                    {event.error && (
                      <p className="mt-1 text-[11px] text-error">{event.error}</p>
                    )}
                    {!!(event.args || event.result) && (
                      <pre className="mt-1.5 max-h-32 overflow-auto rounded-lg bg-surface-container-low p-2 text-[10px] text-on-surface-variant font-mono scrollbar-thin">
                        {JSON.stringify(event.args || event.result, null, 2)}
                      </pre>
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

function ConversationRow({
  conversation,
  selected,
  onClick,
  language,
}: {
  conversation: DashboardAnalyticsConversationListItem;
  selected: boolean;
  onClick: () => void;
  language: "en" | "sv";
}) {
  const { t } = useLanguage();
  const identityDisplay = resolveIdentityDisplay(
    conversation.identitySummary,
    t("analytics.anonymousUser"),
    conversation.agentLabel || conversation.agentName,
  );
  const presenceDisplay = resolvePresenceDisplay(conversation.presenceStatus, t);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full border-b border-outline-variant/10 px-5 py-4 text-left transition-colors ${
        selected
          ? "bg-primary/[0.08] dark:bg-primary/15 shadow-xs"
          : "hover:bg-surface-container-low/70"
      }`}
    >
      {selected && (
        <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
      )}

      <div className="flex items-start gap-4">
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${
          conversation.hasLead
            ? "bg-primary/10 text-primary ring-primary/15"
            : "bg-surface-container text-on-surface-variant ring-outline-variant/10"
        }`}>
          {identityDisplay.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-on-surface transition-colors group-hover:text-primary">
              {identityDisplay.primary}
            </p>
            <span className="shrink-0 text-xs font-medium text-on-surface-variant/70">
              {formatRelativeDate(conversation.lastActivityAt, language)}
            </span>
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <p className="truncate text-xs font-medium text-on-surface-variant">
              {identityDisplay.secondary}
            </p>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${presenceDisplay.className}`}>
              {presenceDisplay.isLive ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${presenceDisplay.dotClassName}`} />
              )}
              {presenceDisplay.label}
            </span>
            {conversation.hasLead && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">
            {conversation.latestSnippet || t("analytics.monitoringSession")}
          </p>
          
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium text-on-surface-variant/55">
                {conversation.widgetName || t("analytics.globalWidget")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                <MessageSquare className="h-3 w-3" />
                <span className="text-xs font-semibold">{conversation.messageCount}</span>
              </div>
              {conversation.hasLead && (
                <div className="flex items-center gap-1 text-primary">
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-semibold">{t("analytics.leadCaptured")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationInboxPane({
  state,
  onSelectConversation,
  onLoadMore,
}: {
  state: DashboardAnalyticsState;
  onSelectConversation: (widgetSessionId: string) => void;
  onLoadMore: () => void;
}) {
  const { t, language } = useLanguage();
  const conversations = state.data?.conversations ?? [];
  const hasMore = Boolean(state.data?.pageInfo.hasMore);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/10 px-5 py-4">
        <h2 className="truncate text-sm font-semibold tracking-normal text-on-surface">
          {t("analytics.inboxTitle")}
        </h2>
        <span className="shrink-0 rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-on-surface-variant">
          {t("analytics.conversationResults", { count: conversations.length })}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {state.isLoading ? (
          <div className="animate-pulse space-y-3 p-5">
            <div className="h-24 rounded-xl bg-surface-container-low" />
            <div className="h-24 rounded-xl bg-surface-container-low" />
            <div className="h-24 rounded-xl bg-surface-container-low" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-10 py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/55 ring-1 ring-outline-variant/15">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-on-surface">{t("analytics.noConversations")}</p>
            <p className="mt-1.5 text-[12px] text-on-surface-variant">{t("analytics.awaitingConversations")}</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.widgetSessionId}
                conversation={conversation}
                selected={state.selectedWidgetSessionId === conversation.widgetSessionId}
                onClick={() => onSelectConversation(conversation.widgetSessionId)}
                language={language}
              />
            ))}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={state.isLoadingMore}
                  className="h-10 rounded-xl border border-outline-variant/15 px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state.isLoadingMore ? t("analytics.loading") : t("analytics.loadMoreSignals")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ConversationDetail({
  detail,
  isLoading,
  onClose,
  onSummaryChange,
}: {
  detail: DashboardConversationDetailResponse | null;
  isLoading: boolean;
  onClose?: () => void;
  onSummaryChange?: (
    widgetSessionId: string,
    summary: LeadConversationSummary,
  ) => void;
}) {
  const { t, language } = useLanguage();
  const identityDisplay = detail
    ? resolveIdentityDisplay(
        detail.identitySummary,
        t("analytics.anonymousUser"),
        detail.conversation.agentLabel || detail.conversation.agentName,
      )
    : null;
  const contactName = detail?.lead?.name || detail?.identitySummary?.name || null;
  const contactPhone = detail?.lead?.phone || detail?.identitySummary?.phone || null;
  const capturedAt = detail?.lead?.createdAt ?? null;
  const showContactDetails = Boolean(contactName || contactPhone || capturedAt);
  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-surface">
      <div className="shrink-0 border-b border-outline-variant/10 p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-normal text-on-surface sm:text-2xl">
              {detail
                ? identityDisplay?.primary
                : t("analytics.operationalPreview")}
            </h2>

            {detail && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  detail.conversation.source === "hosted"
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}>
                  {detail.conversation.source}
                </span>
                <span className="text-xs font-medium text-on-surface-variant">
                  {t("analytics.sessionInitialized")} {formatRelativeDate(detail.conversation.startedAt, language)}
                </span>
                {detail?.lead && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {t("analytics.leadCaptured")}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close conversation detail"
                className="rounded-xl bg-surface-container-low p-2.5 transition-colors hover:bg-surface-container-high lg:hidden"
              >
                <X className="h-5 w-5 text-on-surface-variant" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary contact details — name / phone / captured at only. Email is already shown as the heading above. */}
        {showContactDetails && (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {contactName && (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
                <p className="text-xs font-medium text-on-surface-variant/65">
                  Name
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-on-surface">
                  {contactName}
                </p>
              </div>
            )}

            {contactPhone && (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
                <p className="text-xs font-medium text-on-surface-variant/65">
                  Phone
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-on-surface">
                  {contactPhone}
                </p>
              </div>
            )}

            {capturedAt && (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
                <p className="text-xs font-medium text-on-surface-variant/65">
                  Captured
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-on-surface">
                  {formatRelativeDate(capturedAt, language)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="h-28 w-2/3 animate-pulse rounded-xl bg-surface-container-low" />
          <div className="ml-auto h-28 w-1/2 animate-pulse rounded-xl bg-primary/10" />
          <div className="h-40 w-3/4 animate-pulse rounded-xl bg-surface-container-low" />
        </div>
      ) : !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/55 ring-1 ring-outline-variant/15">
            <BarChart3 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold tracking-normal text-on-surface">{t("analytics.noSessionSelected")}</h3>
          <p className="mt-2 text-sm text-on-surface-variant max-w-xs leading-relaxed">
            {t("analytics.selectSession")}
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-8 overflow-y-auto p-6 pb-24 hide-scrollbar">
          {detail.lead ? (
            <div className="mx-auto w-full max-w-4xl">
              <LeadAiSummaryCard
                leadId={detail.lead.id}
                summary={detail.aiSummary}
                onSummaryChange={(summary) =>
                  onSummaryChange?.(
                    detail.conversation.widgetSessionId,
                    summary,
                  )
                }
              />
            </div>
          ) : null}

          {detail.transcript.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-on-surface-variant/40">
              <MessagesSquare className="mb-4 h-10 w-10" aria-hidden="true" />
              <p className="text-sm italic">{t("analytics.waitingInitialMessage")}</p>
            </div>
          ) : (
            detail.transcript.map((message) => {
              const attachments = readConversationAttachments(message.metadata);

              return (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === "user" ? "ml-auto max-w-2xl flex-row-reverse" : "max-w-3xl"}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${
                    message.role === "user"
                      ? "bg-surface-container text-on-surface-variant ring-outline-variant/10"
                      : "bg-primary/10 text-primary ring-primary/15"
                  }`}
                  >
                    {message.role === "user"
                      ? (identityDisplay?.initials || "U")
                      : <Bot className="h-4 w-4" aria-hidden="true" />}
                  </div>

                  <div className={`space-y-2 ${message.role === "user" ? "text-right" : ""}`}>
                    <div className={`flex items-baseline gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      <span className={`text-sm font-semibold ${message.role === "user" ? "text-on-surface" : "text-primary"}`}>
                        {message.role === "user"
                          ? (identityDisplay?.primary || t("analytics.anonymousUser"))
                          : (detail.conversation.agentLabel || t("analytics.aiAgent"))}
                      </span>
                      <span className="text-xs font-medium text-on-surface-variant/50">{formatRelativeDate(message.createdAt, language)}</span>
                    </div>

                    <div className={`rounded-xl border p-4 shadow-sm ${
                      message.role === "user"
                        ? "border-primary/15 bg-primary/10 text-on-surface"
                        : "border-outline-variant/15 bg-surface-container-lowest text-on-surface"
                    }`}
                    >
                      <p className="text-sm leading-6">
                        {message.content}
                      </p>

                      <ConversationAttachments
                        attachments={attachments}
                        alignEnd={message.role === "user"}
                      />

                      {message.role === "assistant" && message.debugTrace && (
                        <DebugPanel trace={message.debugTrace} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

/**
 * One headline number.
 *
 * A handful of totals is a KPI row, not a chart — so these stay tiles. They are
 * deliberately one line tall: this page's main job is the conversation inbox
 * below, and a dashboard-sized card row would eat the space the inbox needs.
 */
function AnalyticsStat({
  item,
  isLoading,
}: {
  item: AnalyticsStatItem;
  isLoading: boolean;
}) {
  const Icon = item.icon;
  const toneClass =
    item.tone === "success"
      ? "bg-success-container text-success"
      : item.tone === "error"
        ? "bg-error-container text-error"
        : "bg-primary/10 text-primary";

  return (
    <article className="flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-low px-3.5 py-3 sm:min-w-0 sm:shrink">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-on-surface-variant">
            {item.label}
          </p>
          <span className="shrink-0 truncate text-[11px] font-medium text-on-surface-variant/55">
            {item.meta}
          </span>
        </div>
        {isLoading ? (
          <span className="mt-1.5 block h-5 w-14 animate-pulse rounded bg-surface-container" />
        ) : (
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="font-headline text-xl font-extrabold tabular-nums tracking-tight text-on-surface">
              {item.value}
            </span>
            {item.sparkline ? <StatSparkline series={item.sparkline} /> : null}
          </div>
        )}
      </div>
    </article>
  );
}

function AnalyticsStatRow({
  items,
  isLoading,
}: {
  items: AnalyticsStatItem[];
  isLoading: boolean;
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-0.5 hide-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
      {items.map((item) => (
        <AnalyticsStat key={item.key} item={item} isLoading={isLoading} />
      ))}
    </div>
  );
}

function AnalyticsViewSwitch({
  activeView,
  conversations,
  automations,
  onChange,
}: {
  activeView: "conversations" | "automations";
  conversations: number;
  automations: number;
  onChange: (view: "conversations" | "automations") => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex rounded-xl border border-outline-variant/15 bg-surface-container-low p-1 sm:inline-grid sm:grid-cols-2">
      {([
        ["conversations", t("analytics.conversationsView"), conversations],
        ["automations", t("analytics.automationsView"), automations],
      ] as const).map(([value, label, count]) => {
        const selected = activeView === value;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={`flex h-8 min-w-0 items-center justify-between gap-2.5 rounded-lg px-3 text-xs font-bold transition-all duration-200 focus:outline-none ${
              selected
                ? "bg-surface-container-lowest text-on-surface shadow-xs ring-1 ring-outline-variant/15"
                : "text-on-surface-variant hover:bg-surface-container/60 hover:text-on-surface"
            }`}
          >
            <span className="truncate">{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums transition-colors ${
                selected
                  ? "bg-primary/12 text-primary"
                  : "bg-surface-container text-on-surface-variant/70"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsFilterBar({
  filters,
  data,
  activeView,
  miloMode,
  onChange,
}: {
  filters: DashboardAnalyticsAppliedFilters;
  data: DashboardAnalyticsResponse | null;
  activeView: "conversations" | "automations";
  miloMode: boolean;
  onChange: (filters: DashboardAnalyticsAppliedFilters) => void;
}) {
  const { t } = useLanguage();
  const rangeOptions: Array<{
    value: DashboardAnalyticsAppliedFilters["range"];
    label: string;
  }> = [
    { value: "7d", label: t("analytics.range7d") },
    { value: "30d", label: t("analytics.range30d") },
    { value: "90d", label: t("analytics.range90d") },
  ];
  const agentOptions = (data?.filters.agents ?? []).filter((agent) =>
    activeView === "automations"
      ? agent.surface === "automation"
      : agent.surface === "widget",
  );
  const selectClass =
    "h-9 min-w-0 rounded-lg border border-outline-variant/25 bg-surface-container-low py-0 pl-2.5 pr-7 text-xs font-semibold text-on-surface outline-none transition-colors hover:border-outline-variant/40 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={t("analytics.filterRange")}
        className="inline-flex shrink-0 rounded-lg border border-outline-variant/15 bg-surface-container-low p-0.5"
      >
        {rangeOptions.map((option) => {
          const selected = filters.range === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ ...filters, range: option.value })}
              className={`h-8 rounded-[7px] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 ${
                selected
                  ? "bg-surface-container-lowest text-on-surface shadow-xs ring-1 ring-outline-variant/15"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <select
        aria-label={t("analytics.filterAgent")}
        value={filters.agentId ?? ""}
        onChange={(event) =>
          onChange({ ...filters, agentId: event.target.value || null })
        }
        className={selectClass}
      >
        <option value="">
          {miloMode && activeView === "conversations"
            ? t("nav.milo")
            : t("analytics.allAgents")}
        </option>
        {agentOptions.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>

      {activeView === "automations" ? (
        <select
          aria-label={t("analytics.filterStatus")}
          value={filters.automationStatus}
          onChange={(event) =>
            onChange({
              ...filters,
              automationStatus: event.target
                .value as DashboardAnalyticsAppliedFilters["automationStatus"],
            })
          }
          className={selectClass}
        >
          <option value="all">{t("analytics.allStatuses")}</option>
          <option value="processed">{t("analytics.automationStatusProcessed")}</option>
          <option value="failed">{t("analytics.automationStatusFailed")}</option>
          <option value="ignored">{t("analytics.automationStatusIgnored")}</option>
          <option value="processing">{t("analytics.automationStatusProcessing")}</option>
          <option value="received">{t("analytics.automationStatusReceived")}</option>
        </select>
      ) : (
        <>
          <select
            aria-label={t("analytics.filterWidget")}
            value={filters.widgetId ?? ""}
            onChange={(event) =>
              onChange({ ...filters, widgetId: event.target.value || null })
            }
            className={selectClass}
          >
            <option value="">
              {miloMode ? t("nav.websiteChat") : t("analytics.allWidgets")}
            </option>
            {(data?.filters.widgets ?? []).map((widget) => (
              <option key={widget.id} value={widget.id}>
                {widget.name}
              </option>
            ))}
          </select>

          <select
            aria-label={t("analytics.filterStatus")}
            value={filters.sessionStatus}
            onChange={(event) =>
              onChange({
                ...filters,
                sessionStatus: event.target
                  .value as DashboardAnalyticsAppliedFilters["sessionStatus"],
              })
            }
            className={selectClass}
          >
            <option value="all">{t("analytics.allStatuses")}</option>
            <option value="live">{t("analytics.statusLive")}</option>
            <option value="idle">{t("analytics.statusIdle")}</option>
            <option value="completed">{t("analytics.statusCompleted")}</option>
          </select>

          <div className="relative min-w-[11rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant/50"
              aria-hidden="true"
            />
            <input
              aria-label={t("analytics.searchLabel")}
              value={filters.search}
              onChange={(event) =>
                onChange({ ...filters, search: event.target.value })
              }
              placeholder={t("analytics.searchPlaceholder")}
              className="h-9 w-full rounded-lg border border-outline-variant/25 bg-surface-container-low pl-8 pr-3 text-xs font-semibold text-on-surface outline-none transition-colors placeholder:font-medium placeholder:text-on-surface-variant/45 hover:border-outline-variant/40 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Groups large totals so a four-figure count stays scannable at a glance. */
function formatStatNumber(value: number, language: "en" | "sv") {
  return formatLocaleNumber(value, language);
}

function formatTrendDate(value: string, language: "en" | "sv") {
  return formatLocaleDate(`${value}T00:00:00`, language, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Daily processed-vs-failed outcomes as a stacked column chart.
 *
 * Replaces a row-per-day bar list, which at a 90 day range was 90 rows of
 * scrolling — a table pretending to be a chart.
 *
 * Processed and failed are status colors, and green-vs-red is the worst case
 * for red-green color blindness: the app's own success/error tokens measure
 * only ΔE 5.0 (light) and 6.5 (dark) apart under deuteranopia. So hue never
 * carries the distinction alone here — a labelled legend, a fixed stacking
 * order, a 2px surface gap between the two segments, and exact numbers in every
 * tooltip all repeat the same information.
 */
function AutomationTrendChart({
  trend,
  language,
}: {
  trend: DashboardAutomationTrendPoint[];
  language: "en" | "sv";
}) {
  const { t } = useLanguage();
  const maxEvents = Math.max(1, ...trend.map((point) => point.totalEvents));
  // The cap only exists so a 7 day range does not render as slabs; at longer
  // ranges the columns shrink below it on their own.
  const barMaxWidth =
    trend.length <= 10 ? 40 : trend.length <= 31 ? 26 : 14;
  // Only the ends and the middle are labelled, and they are laid out across the
  // whole plot rather than inside one column — at a 90 day range a column is a
  // few pixels wide and a per-column label truncates to an unreadable sliver.
  const axisLabels = Array.from(
    new Set(
      trend.length <= 1
        ? [0]
        : [0, Math.floor((trend.length - 1) / 2), trend.length - 1],
    ),
  )
    .map((index) => trend[index])
    .filter(Boolean);

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-success" aria-hidden="true" />
          {t("analytics.legendProcessed")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-error" aria-hidden="true" />
          {t("analytics.legendFailed")}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex h-36 w-7 shrink-0 flex-col justify-between py-0 text-right">
          <span className="text-[10px] font-medium tabular-nums text-on-surface-variant/50">
            {maxEvents}
          </span>
          <span className="text-[10px] font-medium tabular-nums text-on-surface-variant/50">
            0
          </span>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Recessive magnitude reference: a ceiling at the max and a baseline. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-outline-variant/30"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-outline-variant/30"
          />

          <div className="flex h-36 items-end gap-[3px]">
            {trend.map((point) => {
              const failedHeight =
                point.failedEvents > 0
                  ? Math.max(3, (point.failedEvents / maxEvents) * 100)
                  : 0;
              const processedHeight =
                point.processedEvents > 0
                  ? Math.max(3, (point.processedEvents / maxEvents) * 100)
                  : 0;
              const tooltip = t("analytics.trendTooltip", {
                processed: point.processedEvents,
                failed: point.failedEvents,
              });

              return (
                <div
                  key={point.date}
                  className="group relative flex h-full min-w-[3px] flex-1 justify-center"
                >
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1.5 text-[11px] shadow-panel group-hover:block">
                    <span className="block font-semibold text-on-surface">
                      {formatTrendDate(point.date, language)}
                    </span>
                    <span className="mt-0.5 block font-medium text-on-surface-variant">
                      {tooltip}
                    </span>
                  </span>

                  {/* Thin marks: a wide range must not inflate into slab bars. */}
                  <div
                    className="flex h-full w-full flex-col justify-end gap-[2px]"
                    style={{ maxWidth: `${barMaxWidth}px` }}
                  >
                    {failedHeight > 0 ? (
                      <div
                        className="w-full rounded-t-[4px] bg-error"
                        style={{ height: `${failedHeight}%` }}
                      />
                    ) : null}
                    {processedHeight > 0 ? (
                      <div
                        className={`w-full bg-success ${failedHeight > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${processedHeight}%` }}
                      />
                    ) : null}
                    {failedHeight === 0 && processedHeight === 0 ? (
                      <div className="h-[3px] w-full rounded-[2px] bg-surface-container-high" />
                    ) : null}
                  </div>

                  <span className="sr-only">
                    {formatTrendDate(point.date, language)}: {tooltip}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="w-7 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-center justify-between">
          {axisLabels.map((point) => (
            <span
              key={point.date}
              className="whitespace-nowrap text-[10px] font-medium text-on-surface-variant/55"
            >
              {formatTrendDate(point.date, language)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationPerformancePanel({
  data,
  isLoading,
  language,
}: {
  data: DashboardAnalyticsResponse | null;
  isLoading: boolean;
  language: "en" | "sv";
}) {
  const { t } = useLanguage();
  const automation = data?.automation ?? null;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-surface px-4 py-5 lg:px-6">
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
        </div>
      ) : !automation || automation.totalEvents === 0 ? (
        <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/55 ring-1 ring-outline-variant/15">
            <Workflow className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-on-surface">{t("analytics.automationEmptyTitle")}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant/70">
            {t("analytics.automationEmptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/10 px-5 py-4">
                <h2 className="text-sm font-semibold text-on-surface">{t("analytics.automationAgentsTitle")}</h2>
                <p className="mt-1 text-xs text-on-surface-variant/60">{t("analytics.automationAgentsSubtitle")}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                    <tr>
                      <th className="px-5 py-3">{t("analytics.automationColAgent")}</th>
                      <th className="px-3 py-3">{t("analytics.automationColEvents")}</th>
                      <th className="px-3 py-3">{t("analytics.automationColProcessed")}</th>
                      <th className="px-3 py-3">{t("analytics.automationColFailed")}</th>
                      <th className="px-3 py-3">{t("analytics.automationColAction")}</th>
                      <th className="px-3 py-3">{t("analytics.automationColLastEvent")}</th>
                      <th className="px-5 py-3 text-right">{t("analytics.automationColActivity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {automation.agents.map((agent) => (
                      <tr key={agent.agentId} className="hover:bg-surface-container-low/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-on-surface">{agent.agentName}</p>
                          <p className="mt-1 text-xs text-on-surface-variant/60">{agent.status}</p>
                        </td>
                        <td className="px-3 py-4 tabular-nums text-on-surface">{agent.totalEvents}</td>
                        <td className="px-3 py-4 tabular-nums text-success">{agent.processedEvents}</td>
                        <td className="px-3 py-4 tabular-nums text-error">{agent.failedEvents}</td>
                        <td className="px-3 py-4 text-on-surface-variant">
                          {t("analytics.automationActionSummary", { taken: agent.actionTaken, none: agent.noAction })}
                        </td>
                        <td className="px-3 py-4 text-xs text-on-surface-variant">
                          {agent.lastEventAt ? formatRelativeDate(agent.lastEventAt, language) : t("analytics.automationNever")}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={agent.activityHref} className="text-xs font-semibold text-primary hover:underline">
                            {t("analytics.automationViewActivity")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/10 px-5 py-4">
                <h2 className="text-sm font-semibold text-on-surface">{t("analytics.automationRecentFailuresTitle")}</h2>
                <p className="mt-1 text-xs text-on-surface-variant/60">{t("analytics.automationRecentFailuresSubtitle")}</p>
              </div>
              {automation.recentFailures.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-on-surface">{t("analytics.automationNoFailuresTitle")}</p>
                  <p className="mt-1 text-sm text-on-surface-variant/65">{t("analytics.automationNoFailuresBody")}</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {automation.recentFailures.map((failure) => (
                    <Link
                      key={failure.eventId}
                      href={failure.activityHref}
                      className="block px-5 py-4 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-on-surface">{failure.agentName}</p>
                          <p className="mt-1 truncate text-xs text-on-surface-variant/65">{failure.summary ?? failure.errorMessage ?? failure.triggerLabel}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error ring-1 ring-error/15">
                          {t("analytics.automationFailedBadge")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-on-surface-variant/55">
                        {formatRelativeDate(failure.createdAt, language)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-on-surface">{t("analytics.automationTrendTitle")}</h2>
              <p className="mt-1 text-xs text-on-surface-variant/60">{t("analytics.automationTrendSubtitle")}</p>
            </div>
            <AutomationTrendChart trend={automation.trend} language={language} />
          </section>
        </div>
      )}
    </main>
  );
}

export function AnalyticsWorkspaceView() {
  const { user, workspace } = useAppContext();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const miloMode =
    workspace.product_experience === "milo" &&
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false";
  const automationsEnabled = hasAutomationsEnabled(workspace);
  const [activeView, setActiveView] = useState<"conversations" | "automations">("conversations");
  const [filters, setFilters] = useState<DashboardAnalyticsAppliedFilters>({
    range: "30d",
    widgetId: null,
    agentId: null,
    automationStatus: "all",
    search: "",
    sessionStatus: "all",
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
  const detailCacheRef = useRef<DashboardAnalyticsState["detailCache"]>({});
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const analyticsUrl = useMemo(
    () => buildAnalyticsUrl(effectiveFilters),
    [effectiveFilters],
  );
  const {
    data: analyticsData,
    error: analyticsError,
    isLoading: isAnalyticsLoading,
  } = useSWR<DashboardAnalyticsResponse>(
    workspaceSWRKey(user.id, workspace.id, analyticsUrl),
    jsonFetcher,
    { keepPreviousData: true },
  );

  useEffect(() => {
    detailCacheRef.current = state.detailCache;
  }, [state.detailCache]);

  useEffect(() => {
    setState((current) => ({
      ...current,
      isLoading: isAnalyticsLoading,
    }));
  }, [isAnalyticsLoading]);

  useEffect(() => {
    if (!analyticsData) {
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: false,
      data: analyticsData,
    }));
  }, [analyticsData]);

  useEffect(() => {
    if (!analyticsError) {
      return;
    }

    showToast(
      analyticsError instanceof Error ? analyticsError.message : t("analytics.loadError"),
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
  }, [analyticsError, showToast, t]);

  useEffect(() => {
    const conversations = state.data?.conversations ?? [];

    if (conversations.length === 0) {
      if (!state.isLoading) {
        setState((current) => ({
          ...current,
          selectedWidgetSessionId: null,
          selectedConversation: null,
        }));
        setIsMobileDetailOpen(false);
      }
      return;
    }

    const selectionStillExists = conversations.some(
      (conversation) => conversation.widgetSessionId === state.selectedWidgetSessionId,
    );

    if (
      requestedSessionId &&
      conversations.some(
        (conversation) => conversation.widgetSessionId === requestedSessionId,
      ) &&
      state.selectedWidgetSessionId !== requestedSessionId
    ) {
      setState((current) => ({
        ...current,
        selectedWidgetSessionId: requestedSessionId,
      }));
      return;
    }

    if (!selectionStillExists && !state.isLoading) {
      setState((current) => ({
        ...current,
        selectedWidgetSessionId: conversations[0].widgetSessionId,
      }));
    }
  }, [
    requestedSessionId,
    state.data?.conversations,
    state.selectedWidgetSessionId,
    state.isLoading,
  ]);

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

      const cachedDetail = detailCacheRef.current[sessionId];
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
          throw new Error(payload?.error || t("analytics.detailLoadError"));
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
            : t("analytics.detailLoadError"),
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
  }, [showToast, state.selectedWidgetSessionId, t]);

  const loadMore = async () => {
    if (!state.data?.pageInfo.nextCursor) {
      return;
    }

    setState((current) => ({
      ...current,
      isLoadingMore: true,
    }));

    try {
      const payload = await jsonFetcher<DashboardAnalyticsResponse>(
        buildAnalyticsUrl(effectiveFilters, state.data.pageInfo.nextCursor),
      );

      setState((current) => {
        const previous = current.data;
        const next = payload;

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
          : t("analytics.loadMoreError"),
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

  const handleSummaryChange = (
    widgetSessionId: string,
    summary: LeadConversationSummary,
  ) => {
    setState((current) => {
      const selectedConversation =
        current.selectedConversation?.conversation.widgetSessionId ===
        widgetSessionId
          ? { ...current.selectedConversation, aiSummary: summary }
          : current.selectedConversation;
      const cachedConversation = current.detailCache[widgetSessionId];

      return {
        ...current,
        selectedConversation,
        detailCache: cachedConversation
          ? {
              ...current.detailCache,
              [widgetSessionId]: {
                ...cachedConversation,
                aiSummary: summary,
              },
            }
          : current.detailCache,
      };
    });
  };

  const overview = state.data?.overview;
  const automation = state.data?.automation;
  const hasActiveAutomations =
    automationsEnabled &&
    Boolean(
      (automation?.totalEvents && automation.totalEvents > 0) ||
      (automation?.agents && automation.agents.length > 0) ||
      state.data?.filters.agents.some((agent) => agent.surface === "automation"),
    );
  const effectiveActiveView = hasActiveAutomations ? activeView : "conversations";

  useEffect(() => {
    if (!hasActiveAutomations && activeView === "automations") {
      setActiveView("conversations");
    }
  }, [hasActiveAutomations, activeView]);

  useEffect(() => {
    if (!hasActiveAutomations) {
      if (filters.automationStatus !== "all") {
        setFilters((current) => ({ ...current, automationStatus: "all" }));
      }
      if (
        filters.agentId &&
        state.data?.filters.agents.some(
          (agent) => agent.id === filters.agentId && agent.surface === "automation",
        )
      ) {
        setFilters((current) => ({ ...current, agentId: null }));
      }
    }
  }, [hasActiveAutomations, filters.automationStatus, filters.agentId, state.data?.filters.agents]);

  const isOverviewLoading = state.isLoading && !state.data;
  const trend = state.data?.trend ?? [];
  const conversationStats: AnalyticsStatItem[] = [
    {
      key: "conversations",
      sparkline: trend.map((point) => point.conversations),
      label: t("analytics.statConversations"),
      value: formatStatNumber(overview?.conversations ?? 0, language),
      meta: t("analytics.statConversationsMeta"),
      icon: MessagesSquare,
    },
    {
      key: "leads",
      sparkline: trend.map((point) => point.leads),
      label: t("analytics.statLeads"),
      value: formatStatNumber(overview?.leads ?? 0, language),
      meta: t("analytics.statLeadsMeta"),
      icon: Users,
    },
    {
      key: "messages",
      sparkline: trend.map((point) => point.messages),
      label: t("analytics.statMessages"),
      value: formatStatNumber(overview?.messages ?? 0, language),
      meta: t("analytics.statMessagesMeta"),
      icon: MessageSquare,
    },
    {
      key: "widgets",
      label: t("analytics.statLiveWidgets"),
      value: formatStatNumber(overview?.activeWidgets ?? 0, language),
      meta: t("analytics.statLiveWidgetsMeta"),
      icon: Activity,
      tone: "success",
    },
  ];
  const automationFailures = automation?.failedEvents ?? 0;
  const automationStats: AnalyticsStatItem[] = [
    {
      key: "events",
      label: t("analytics.statEvents"),
      value: formatStatNumber(automation?.totalEvents ?? 0, language),
      meta: t("analytics.statEventsMeta", {
        count: automation?.processedEvents ?? 0,
      }),
      icon: Workflow,
    },
    {
      key: "successRate",
      label: t("analytics.statSuccessRate"),
      value: `${automation?.successRate ?? 0}%`,
      meta: t("analytics.statSuccessRateMeta", {
        count: automation?.actionTaken ?? 0,
      }),
      icon: TrendingUp,
      tone: "success",
    },
    {
      key: "failures",
      label: t("analytics.statFailures"),
      value: formatStatNumber(automationFailures, language),
      meta:
        automationFailures > 0
          ? t("analytics.statFailuresMeta")
          : t("analytics.statFailuresNoneMeta"),
      icon: automationFailures > 0 ? AlertCircle : CheckCircle2,
      tone: automationFailures > 0 ? "error" : "success",
    },
  ];
  const stats =
    effectiveActiveView === "automations" ? automationStats : conversationStats;

  const handleViewChange = (view: "conversations" | "automations") => {
    setActiveView(view);
    if (view === "automations") {
      setFilters((current) => ({
        ...current,
        agentId: null,
        widgetId: null,
        search: "",
        sessionStatus: "all",
      }));
    } else {
      setFilters((current) => ({
        ...current,
        agentId: null,
        automationStatus: "all",
      }));
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface">
      <header className="shrink-0 border-b border-outline-variant/10 bg-surface-container-lowest px-4 py-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-headline text-xl font-extrabold tracking-tight text-on-surface">
                {t("analytics.title")}
              </h1>
              <p className="mt-0.5 hidden truncate text-xs font-medium text-on-surface-variant sm:block">
                {effectiveActiveView === "automations"
                  ? t("analytics.automationsSubtitle")
                  : t("analytics.conversationsSubtitle")}
              </p>
            </div>

            {hasActiveAutomations ? (
              <AnalyticsViewSwitch
                activeView={effectiveActiveView}
                conversations={overview?.conversations ?? 0}
                automations={automation?.totalEvents ?? 0}
                onChange={handleViewChange}
              />
            ) : null}
          </div>

          <AnalyticsStatRow items={stats} isLoading={isOverviewLoading} />

          <AnalyticsFilterBar
            filters={filters}
            data={state.data}
            activeView={effectiveActiveView}
            miloMode={miloMode}
            onChange={(nextFilters) => setFilters(nextFilters)}
          />
        </div>
      </header>

      {effectiveActiveView === "automations" ? (
        <AutomationPerformancePanel
          data={state.data}
          isLoading={state.isLoading}
          language={language}
        />
      ) : (
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-[384px] shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest lg:block">
            <ConversationInboxPane
              state={state}
              onSelectConversation={handleSelectConversation}
              onLoadMore={() => void loadMore()}
            />
          </aside>

          <section className="relative flex min-w-0 flex-1 flex-col bg-surface">
            <div className="max-h-[45vh] overflow-hidden border-b border-outline-variant/10 lg:hidden">
              <ConversationInboxPane
                state={state}
                onSelectConversation={handleSelectConversation}
                onLoadMore={() => void loadMore()}
              />
            </div>
            <ConversationDetail
              detail={state.selectedConversation}
              isLoading={state.isDetailLoading}
              onSummaryChange={handleSummaryChange}
            />
          </section>
        </main>
      )}

      {isMobileDetailOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm lg:hidden">
          <div className="h-full w-full overflow-hidden rounded-2xl bg-surface">
            <ConversationDetail
              detail={state.selectedConversation}
              isLoading={state.isDetailLoading}
              onClose={() => setIsMobileDetailOpen(false)}
              onSummaryChange={handleSummaryChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
