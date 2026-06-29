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

import { useToast } from "@/components/ui/ToastProvider";
import { LeadAiSummaryCard } from "@/components/leads/LeadAiSummaryCard";
import { jsonFetcher } from "@/lib/json-fetcher";
import { formatRelativeDate } from "@/lib/utils";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsResponse,
  DashboardConversationDetailResponse,
  DebugTrace,
  LeadConversationSummary,
} from "@/lib/types";
import {
  Activity,
  AlertCircle,
  Bug,
  ChevronRight,
  MessageSquare,
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
            <span className="material-symbols-outlined text-[14px]">attachment</span>
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

type HeaderMetricItem = {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: "neutral" | "success" | "warning" | "error";
};

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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full border-b border-outline-variant/10 px-5 py-4 text-left transition-colors ${
        selected
          ? "bg-surface-container-lowest"
          : "hover:bg-surface-container-low/60"
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
            <span className="shrink-0 text-xs font-medium text-on-surface-variant/60">
              {formatRelativeDate(conversation.lastActivityAt, language)}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate text-xs font-medium text-on-surface-variant/70">
              {identityDisplay.secondary}
            </p>
            {conversation.hasLead && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant/75">
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
                  <span className="material-symbols-outlined text-[14px]">person_check</span>
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
      <div className="border-b border-outline-variant/10 px-5 py-5">
        <h2 className="text-lg font-semibold tracking-normal text-on-surface">
          Conversations
        </h2>
        <div className="mb-5 mt-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">
            Reporting
          </span>
          <span className="h-1 w-1 rounded-full bg-outline-variant/30" />
          <span className="text-xs font-medium text-on-surface-variant">
            {t("analytics.activeSessions", { count: conversations.length })}
          </span>
        </div>
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
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <p className="text-sm font-medium text-on-surface">{t("analytics.noActiveSessions")}</p>
            <p className="text-[12px] text-on-surface-variant mt-1.5">{t("analytics.awaitingTraffic")}</p>
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
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
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
            <span className="material-symbols-outlined text-3xl">analytics</span>
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
              <span className="material-symbols-outlined text-4xl mb-4">forum</span>
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
                      : <span className="material-symbols-outlined text-sm">smart_toy</span>}
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

function MetricTile({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "error"
          ? "text-error"
          : "text-on-surface";

  return (
    <div className="min-w-0 rounded-xl border border-outline-variant/12 bg-surface px-4 py-3">
      <p className="truncate text-xs font-medium text-on-surface-variant/65">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sublabel ? (
        <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant/55">{sublabel}</p>
      ) : null}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "error"
          ? "text-error"
          : "text-on-surface";

  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[11px] font-semibold text-on-surface-variant/65">
          {label}
        </p>
        <p className={`shrink-0 text-base font-semibold tabular-nums ${toneClass}`}>
          {value}
        </p>
      </div>
      {sublabel ? (
        <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant/50">
          {sublabel}
        </p>
      ) : null}
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
  return (
    <div className="grid grid-cols-2 rounded-xl border border-outline-variant/12 bg-surface-container-low p-1 sm:inline-grid">
      {([
        ["conversations", "Conversations", conversations],
        ["automations", "Automations", automations],
      ] as const).map(([value, label, count]) => {
        const selected = activeView === value;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={`flex h-9 min-w-0 items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 ${
              selected
                ? "bg-on-surface text-background shadow-sm"
                : "text-on-surface-variant hover:bg-surface hover:text-on-surface"
            }`}
          >
            <span className="truncate">{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                selected
                  ? "bg-background/15 text-background"
                  : "bg-surface text-on-surface-variant"
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
  onChange,
}: {
  filters: DashboardAnalyticsAppliedFilters;
  data: DashboardAnalyticsResponse | null;
  activeView: "conversations" | "automations";
  onChange: (filters: DashboardAnalyticsAppliedFilters) => void;
}) {
  const rangeOptions: Array<{ value: DashboardAnalyticsAppliedFilters["range"]; label: string }> = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ];
  const agentOptions = (data?.filters.agents ?? []).filter((agent) =>
    activeView === "automations"
      ? agent.surface === "automation"
      : agent.surface === "widget",
  );

  return (
    <div className="rounded-xl border border-outline-variant/12 bg-surface px-3 py-3">
      <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="hidden text-xs font-semibold text-on-surface-variant/55 sm:inline">
            Range
          </span>
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...filters, range: option.value })}
              className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                filters.range === option.value
                  ? "bg-on-surface text-background"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={`grid min-w-0 gap-2 ${
            activeView === "automations"
              ? "sm:grid-cols-2 lg:min-w-[420px]"
              : "sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(180px,1.2fr)]"
          }`}
        >
          <select
            aria-label="Agent filter"
            value={filters.agentId ?? ""}
            onChange={(event) => onChange({ ...filters, agentId: event.target.value || null })}
            className="h-10 min-w-0 rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary"
          >
            <option value="">All agents</option>
            {agentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>

          {activeView === "automations" ? (
            <select
              aria-label="Automation status filter"
              value={filters.automationStatus}
              onChange={(event) => onChange({
                ...filters,
                automationStatus: event.target.value as DashboardAnalyticsAppliedFilters["automationStatus"],
              })}
              className="h-10 min-w-0 rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
              <option value="ignored">Ignored</option>
              <option value="processing">Processing</option>
              <option value="received">Received</option>
            </select>
          ) : (
            <>
              <select
                aria-label="Widget filter"
                value={filters.widgetId ?? ""}
                onChange={(event) => onChange({ ...filters, widgetId: event.target.value || null })}
                className="h-10 min-w-0 rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary"
              >
                <option value="">All widgets</option>
                {(data?.filters.widgets ?? []).map((widget) => (
                  <option key={widget.id} value={widget.id}>{widget.name}</option>
                ))}
              </select>
              <select
                aria-label="Conversation status filter"
                value={filters.sessionStatus}
                onChange={(event) => onChange({
                  ...filters,
                  sessionStatus: event.target.value as DashboardAnalyticsAppliedFilters["sessionStatus"],
                })}
                className="h-10 min-w-0 rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary"
              >
                <option value="all">All statuses</option>
                <option value="active">Active sessions</option>
                <option value="completed">Completed sessions</option>
              </select>
              <input
                aria-label="Search conversations"
                value={filters.search}
                onChange={(event) => onChange({ ...filters, search: event.target.value })}
                placeholder="Search conversations"
                className="h-10 min-w-0 rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/45 focus:border-primary"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value : 0}%`;
}

function formatTrendDate(value: string, language: "en" | "sv") {
  return new Intl.DateTimeFormat(language === "sv" ? "sv-SE" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
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
  const automation = data?.automation ?? null;
  const maxTrendEvents = Math.max(
    1,
    ...(automation?.trend ?? []).map((point) => point.totalEvents),
  );

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
            <span className="material-symbols-outlined" aria-hidden="true">automation</span>
          </div>
          <h2 className="text-base font-semibold text-on-surface">No automation events in this range</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant/70">
            Automation performance appears after active automation agents receive trigger events.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Events" value={automation.totalEvents} sublabel="Received triggers" />
            <MetricTile label="Processed" value={automation.processedEvents} sublabel={formatPercent(automation.successRate)} />
            <MetricTile label="Failed" value={automation.failedEvents} sublabel="Needs review" />
            <MetricTile label="Action taken" value={automation.actionTaken} sublabel={`${automation.noAction} no action`} />
            <MetricTile label="Needs input" value={automation.needsInput} sublabel={`${automation.actionFailed} action failed`} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
              <div className="border-b border-outline-variant/10 px-5 py-4">
                <h2 className="text-sm font-semibold text-on-surface">Automation agents</h2>
                <p className="mt-1 text-xs text-on-surface-variant/60">Workspace-level automation performance for the selected range.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                    <tr>
                      <th className="px-5 py-3">Agent</th>
                      <th className="px-3 py-3">Events</th>
                      <th className="px-3 py-3">Processed</th>
                      <th className="px-3 py-3">Failed</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Last event</th>
                      <th className="px-5 py-3 text-right">Activity</th>
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
                          {agent.actionTaken} taken / {agent.noAction} none
                        </td>
                        <td className="px-3 py-4 text-xs text-on-surface-variant">
                          {agent.lastEventAt ? formatRelativeDate(agent.lastEventAt, language) : "Never"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={agent.activityHref} className="text-xs font-semibold text-primary hover:underline">
                            View activity
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
                <h2 className="text-sm font-semibold text-on-surface">Recent failures</h2>
                <p className="mt-1 text-xs text-on-surface-variant/60">Open Activity to inspect the exact run and diagnostics.</p>
              </div>
              {automation.recentFailures.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-semibold text-on-surface">No failures in this range</p>
                  <p className="mt-1 text-sm text-on-surface-variant/65">Failed runs will appear here when they need investigation.</p>
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
                          Failed
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
              <h2 className="text-sm font-semibold text-on-surface">Success and failure trend</h2>
              <p className="mt-1 text-xs text-on-surface-variant/60">Daily automation outcomes for the selected range.</p>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {automation.trend.map((point) => {
                const processedWidth = point.processedEvents > 0
                  ? Math.max(4, Math.round((point.processedEvents / maxTrendEvents) * 100))
                  : 0;
                const failedWidth = Math.max(
                  point.failedEvents > 0 ? 4 : 0,
                  Math.round((point.failedEvents / maxTrendEvents) * 100),
                );

                return (
                  <div key={point.date} className="grid gap-3 px-5 py-3 sm:grid-cols-[120px_minmax(0,1fr)_160px] sm:items-center">
                    <p className="text-xs font-semibold text-on-surface">{formatTrendDate(point.date, language)}</p>
                    <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className="bg-success"
                        style={{ width: `${processedWidth}%` }}
                        aria-label={`${point.processedEvents} processed events`}
                      />
                      {point.failedEvents > 0 ? (
                        <div
                          className="bg-error"
                          style={{ width: `${failedWidth}%` }}
                          aria-label={`${point.failedEvents} failed events`}
                        />
                      ) : null}
                    </div>
                    <p className="text-xs font-medium text-on-surface-variant sm:text-right">
                      {point.processedEvents} processed / {point.failedEvents} failed
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function AnalyticsWorkspaceView() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const [activeView, setActiveView] = useState<"conversations" | "automations">("conversations");
  const [isHeaderDetailsOpen, setIsHeaderDetailsOpen] = useState(false);
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
  } = useSWR<DashboardAnalyticsResponse>(analyticsUrl, jsonFetcher);

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
  const conversationHeaderMetrics: HeaderMetricItem[] = [
    {
      label: "Conversations",
      value: overview?.conversations ?? 0,
      sublabel: `${overview?.messages ?? 0} messages`,
    },
    {
      label: "Leads",
      value: overview?.leads ?? 0,
      sublabel: `${overview?.activeWidgets ?? 0} live widgets`,
    },
    {
      label: "Messages",
      value: overview?.messages ?? 0,
      sublabel: "Across selected sessions",
    },
  ];
  const automationHeaderMetrics: HeaderMetricItem[] = [
    {
      label: "Events",
      value: automation?.totalEvents ?? 0,
      sublabel: `${automation?.processedEvents ?? 0} processed`,
      tone: "neutral",
    },
    {
      label: "Success rate",
      value: `${automation?.successRate ?? 0}%`,
      sublabel: `${automation?.actionTaken ?? 0} actions taken`,
      tone: "success",
    },
    {
      label: "Failures",
      value: automation?.failedEvents ?? 0,
      sublabel: "Open Activity to debug",
      tone: (automation?.failedEvents ?? 0) > 0 ? "error" : "neutral",
    },
  ];
  const headerMetrics =
    activeView === "automations" ? automationHeaderMetrics : conversationHeaderMetrics;
  const selectedAgentName =
    state.data?.filters.agents.find((agent) => agent.id === filters.agentId)?.name ??
    "All agents";
  const selectedWidgetName =
    state.data?.filters.widgets.find((widget) => widget.id === filters.widgetId)?.name ??
    "All widgets";
  const rangeLabel =
    filters.range === "7d" ? "7 days" : filters.range === "90d" ? "90 days" : "30 days";
  const statusLabel =
    activeView === "automations"
      ? filters.automationStatus === "all"
        ? "All statuses"
        : filters.automationStatus
            .split("_")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" ")
      : filters.sessionStatus === "all"
        ? "All statuses"
        : filters.sessionStatus[0].toUpperCase() + filters.sessionStatus.slice(1);
  const collapsedDetailSummary =
    activeView === "automations"
      ? `${rangeLabel} · ${selectedAgentName} · ${statusLabel}`
      : `${rangeLabel} · ${selectedAgentName} · ${selectedWidgetName} · ${statusLabel}`;

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
      <header className="shrink-0 border-b border-outline-variant/10 bg-surface-container-lowest px-4 py-3 lg:px-6">
        <div className="grid gap-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.25fr)] xl:items-end">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/45">
                Workspace analytics
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-normal text-on-surface">
                {activeView === "automations" ? "Automation performance" : "Conversation performance"}
              </h1>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <AnalyticsViewSwitch
                activeView={activeView}
                conversations={overview?.conversations ?? 0}
                automations={automation?.totalEvents ?? 0}
                onChange={handleViewChange}
              />

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {!isHeaderDetailsOpen ? (
                  <p className="min-w-0 truncate text-xs font-medium text-on-surface-variant/60">
                    {collapsedDetailSummary}
                  </p>
                ) : null}
                <button
                  type="button"
                  aria-expanded={isHeaderDetailsOpen}
                  aria-controls="analytics-header-details"
                  onClick={() => setIsHeaderDetailsOpen((open) => !open)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-outline-variant/15 bg-surface px-3 text-xs font-semibold text-on-surface-variant transition-colors hover:border-outline-variant/30 hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${isHeaderDetailsOpen ? "rotate-90" : ""}`}
                  />
                  {isHeaderDetailsOpen ? "Hide details" : "Show details"}
                </button>
              </div>
            </div>
          </div>

          {isHeaderDetailsOpen ? (
            <div id="analytics-header-details" className="grid gap-3">
              <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                {headerMetrics.map((metric) => (
                  <HeaderMetric
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    sublabel={metric.sublabel}
                    tone={metric.tone}
                  />
                ))}
              </div>

              <AnalyticsFilterBar
                filters={filters}
                data={state.data}
                activeView={activeView}
                onChange={(nextFilters) => setFilters(nextFilters)}
              />
            </div>
          ) : null}
        </div>
      </header>

      {activeView === "automations" ? (
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
