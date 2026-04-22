"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/ToastProvider";
import { formatRelativeDate } from "@/lib/utils";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsConversationListItem,
  DashboardAnalyticsResponse,
  DashboardConversationDetailResponse,
  DebugTrace,
} from "@/lib/types";
import {
  Activity,
  AlertCircle,
  Bug,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface DashboardAnalyticsState {
  isLoading: boolean;
  isLoadingMore: boolean;
  isDetailLoading: boolean;
  data: DashboardAnalyticsResponse | null;
  selectedWidgetSessionId: string | null;
  selectedConversation: DashboardConversationDetailResponse | null;
  detailCache: Record<string, DashboardConversationDetailResponse>;
}

function buildAnalyticsUrl(
  filters: DashboardAnalyticsAppliedFilters,
  cursor?: string,
) {
  const url = new URL("/api/dashboard/analytics", window.location.origin);
  url.searchParams.set("range", filters.range);
  if (filters.widgetId) url.searchParams.set("widgetId", filters.widgetId);
  if (filters.agentId) url.searchParams.set("agentId", filters.agentId);
  if (filters.search) url.searchParams.set("search", filters.search);
  if (filters.sessionStatus !== "all") url.searchParams.set("sessionStatus", filters.sessionStatus);
  if (cursor) url.searchParams.set("cursor", cursor);
  return url.toString();
}

function AgentFilterSelector({ 
  agents, 
  selectedId, 
  onSelect,
  allLabel,
}: { 
  agents: Array<{ id: string; name: string }>; 
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none hide-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
          selectedId === null
            ? "bg-primary-container text-white shadow-lg shadow-primary-container/20"
            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
        }`}
      >
        {allLabel}
      </button>
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
            selectedId === agent.id
                ? "bg-primary-container text-white shadow-lg shadow-primary-container/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          {agent.name}
        </button>
      ))}
    </div>
  );
}

function DebugPanel({ trace }: { trace: DebugTrace }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant/10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-surface-container-low px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container-high"
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
                      <span className="text-[9px] font-medium text-on-surface-variant/40">+{event.ts}ms</span>
                    </div>
                    {event.error && (
                      <p className="mt-1 text-[11px] text-error">{event.error}</p>
                    )}
                    {!!(event.args || event.result) && (
                      <pre className="mt-1.5 max-h-32 overflow-auto rounded-md bg-surface-container-low p-2 text-[10px] text-on-surface-variant font-mono scrollbar-thin">
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
  
  // Personalization logic: Prioritize Lead name > Lead email > Agent name
  const primaryDisplay = conversation.leadSummary?.name || 
                        conversation.leadSummary?.email || 
                        conversation.agentLabel || 
                        conversation.agentName || 
                        t("analytics.anonymousUser");

  const secondaryDisplay = (conversation.leadSummary?.name && conversation.leadSummary?.email) 
                           ? conversation.leadSummary.email 
                           : (conversation.agentLabel || conversation.agentName);

  const initials = (conversation.leadSummary?.name?.[0] || 
                   conversation.leadSummary?.email?.[0] || 
                   "U").toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full border-b border-outline-variant/5 px-6 py-5 text-left transition-all ${
        selected
          ? "bg-surface-container-lowest shadow-sm"
          : "hover:bg-surface-container-low/60"
      }`}
    >
      {selected && (
        <div className="absolute left-0 top-0 h-full w-1 bg-primary-container" />
      )}
      
      <div className="flex items-start gap-4">
        {/* User Avatar */}
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-headline text-xs font-bold ring-2 ring-offset-2 ring-offset-surface ${
          conversation.hasLead 
            ? "bg-primary-container text-white ring-primary-container/10" 
            : "bg-surface-container-highest text-on-surface-variant ring-transparent"
        }`}>
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-headline text-[15px] font-bold text-on-surface group-hover:text-primary-container transition-colors">
              {primaryDisplay}
            </p>
            <span className="shrink-0 text-[10px] font-medium text-on-surface-variant/60">
              {formatRelativeDate(conversation.lastActivityAt, language)}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate text-[12px] font-medium text-on-surface-variant/70">
              {secondaryDisplay}
            </p>
            {conversation.hasLead && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary-container" />
            )}
          </div>

          <p className="mt-2.5 line-clamp-1 text-[12px] leading-relaxed text-on-surface-variant/80 italic">
            &ldquo;{conversation.latestSnippet || t("analytics.monitoringSession")}&rdquo;
          </p>
          
          <div className="mt-4 flex items-center justify-between border-t border-outline-variant/5 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {conversation.widgetName || t("analytics.globalWidget")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                <MessageSquare className="h-3 w-3" />
                <span className="text-[10px] font-bold">{conversation.messageCount}</span>
              </div>
              {conversation.hasLead && (
                <div className="flex items-center gap-1 text-primary-container">
                  <span className="material-symbols-outlined text-[14px]">person_check</span>
                  <span className="text-[9px] font-bold uppercase tracking-tight">{t("analytics.leadCaptured")}</span>
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
  onAgentSelect,
  selectedAgentId,
}: {
  state: DashboardAnalyticsState;
  onSelectConversation: (widgetSessionId: string) => void;
  onLoadMore: () => void;
  onAgentSelect: (id: string | null) => void;
  selectedAgentId: string | null;
}) {
  const { t, language } = useLanguage();
  const conversations = state.data?.conversations ?? [];
  const hasMore = Boolean(state.data?.pageInfo.hasMore);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-container-low/20">
      <div className="px-6 py-8 border-b border-outline-variant/5 surface-container-low/40">
        <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
          {t("analytics.liveIntelligence")}
        </h2>
        <div className="mt-1.5 flex items-center gap-2 mb-6">
          <span className="text-[11px] font-bold text-primary-container uppercase tracking-widest animate-pulse">
            {t("analytics.monitoring")}
          </span>
          <div className="h-1 w-1 rounded-full bg-outline-variant/30" />
          <span className="text-[11px] font-medium text-on-surface-variant">
            {t("analytics.activeSessions", { count: conversations.length })}
          </span>
        </div>

        {state.data?.filters?.agents && (
          <AgentFilterSelector 
            agents={state.data.filters.agents}
            selectedId={selectedAgentId}
            onSelect={onAgentSelect}
            allLabel={t("analytics.allAgents")}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {state.isLoading ? (
          <div className="animate-pulse space-y-4 p-6">
            <div className="h-24 rounded-2xl bg-surface-container-low" />
            <div className="h-24 rounded-2xl bg-surface-container-low" />
            <div className="h-24 rounded-2xl bg-surface-container-low" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-10">
            <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center text-on-surface-variant/40 mb-4">
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
                  className="rounded-full border border-outline-variant/10 px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
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
}: {
  detail: DashboardConversationDetailResponse | null;
  isLoading: boolean;
  onClose?: () => void;
}) {
  const { t, language } = useLanguage();
  return (
    <section className="flex h-full flex-col bg-surface relative overflow-hidden">
      <div className="shrink-0 p-8 pb-6 border-b border-outline-variant/5">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface truncate">
              {detail
                ? (detail.lead?.name || detail.lead?.email || t("analytics.anonymousUser"))
                : t("analytics.operationalPreview")}
            </h2>
            
            {detail && (
              <div className="flex items-center gap-3 mt-3">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                  detail.conversation.source === 'hosted' 
                    ? 'bg-primary-container/10 text-primary-container' 
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {detail.conversation.source}
                </span>
                <div className="h-1 w-1 rounded-full bg-outline-variant/30" />
                <span className="text-[11px] font-medium text-on-surface-variant">
                  {t("analytics.sessionInitialized")} {formatRelativeDate(detail.conversation.startedAt, language)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {onClose && (
              <button onClick={onClose} className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors lg:hidden">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Lead Contact Card (CRM Style) */}
        {detail?.lead && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary-container/5 flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[18px]">mail</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Email</p>
                <p className="text-[13px] font-medium text-on-surface truncate">{detail.lead.email}</p>
              </div>
            </div>
            
            {detail.lead.phone && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary-container/5 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[18px]">call</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Phone</p>
                  <p className="text-[13px] font-medium text-on-surface truncate">{detail.lead.phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary-container/5 flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[18px]">history</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Captured</p>
                <p className="text-[13px] font-medium text-on-surface truncate">{formatRelativeDate(detail.lead.createdAt, language)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="h-32 w-2/3 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-32 w-1/2 ml-auto animate-pulse rounded-2xl bg-primary-container/10" />
          <div className="h-48 w-3/4 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
      ) : !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 bg-surface-container-low rounded-2xl flex items-center justify-center text-on-surface-variant/40 mb-6">
            <span className="material-symbols-outlined text-3xl">analytics</span>
          </div>
          <h3 className="font-headline text-xl font-bold text-on-surface">{t("analytics.noSessionSelected")}</h3>
          <p className="mt-2 text-sm text-on-surface-variant max-w-xs leading-relaxed">
            {t("analytics.selectSession")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-12 pb-48 space-y-12 hide-scrollbar">
          {detail.transcript.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-on-surface-variant/40">
              <span className="material-symbols-outlined text-4xl mb-4">forum</span>
              <p className="text-sm italic">{t("analytics.waitingInitialMessage")}</p>
            </div>
          ) : (
            detail.transcript.map((message) => (
              <div key={message.id} className={`flex gap-6 ${message.role === "user" ? "max-w-2xl ml-auto flex-row-reverse" : "max-w-3xl"}`}>
                  <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center font-headline font-bold text-xs ring-4 ring-offset-2 ring-offset-surface ${
                    message.role === "user" 
                      ? "bg-on-surface-variant/10 text-on-surface-variant ring-transparent" 
                      : "bg-primary-container text-white ring-primary-container/10"
                  }`}>
                    {message.role === "user" ? (detail.lead?.name?.[0] || "U") : <span className="material-symbols-outlined text-sm">smart_toy</span>}
                  </div>
                  
                  <div className={`space-y-3 ${message.role === "user" ? "text-right" : ""}`}>
                    <div className={`flex items-baseline gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      <span className={`font-headline font-bold text-[13px] ${message.role === "user" ? "text-on-surface" : "text-primary-container"}`}>
                        {message.role === "user"
                          ? (detail.lead?.name || t("analytics.anonymousUser"))
                          : (detail.conversation.agentLabel || t("analytics.aiAgent"))}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{formatRelativeDate(message.createdAt, language)}</span>
                    </div>

                    <div className={`p-6 rounded-2xl shadow-sm border border-black/[0.02] ${
                      message.role === "user" 
                        ? "bg-primary-container text-white" 
                        : "bg-surface-container-lowest text-on-surface"
                    }`}>
                      <p className={`text-[15px] leading-relaxed font-label ${message.role === "user" ? "font-medium" : "font-normal opacity-90"}`}>
                        {message.content}
                      </p>

                      {(message.metadata as { attachments?: { type?: string; url: string; name: string }[] })?.attachments && Array.isArray((message.metadata as { attachments?: { type?: string; url: string; name: string }[] }).attachments) && (message.metadata as { attachments?: { type?: string; url: string; name: string }[] }).attachments!.length > 0 && (
                        <div className={`mt-4 flex flex-wrap gap-2 ${message.role === "user" ? "justify-end" : ""}`}>
                          {(message.metadata as { attachments?: { type?: string; url: string; name: string }[] }).attachments!.map((att, i: number) => (
                            att.type?.startsWith("image/") ? (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                <img src={att.url} alt={att.name} className="w-24 h-24 object-cover rounded-lg border border-black/10 shadow-sm" />
                              </a>
                            ) : (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-black/10 hover:bg-black/20 transition-colors rounded-lg text-xs font-medium shadow-sm">
                                <span className="material-symbols-outlined text-[14px]">attachment</span>
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </a>
                            )
                          ))}
                        </div>
                      )}

                      {message.role === "assistant" && message.debugTrace && (
                        <DebugPanel trace={message.debugTrace} />
                      )}
                    </div>
                  </div>
                </div>

            ))
          )}
        </div>
      )}
    </section>
  );
}

export function AnalyticsWorkspaceView() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const [filters, setFilters] = useState<DashboardAnalyticsAppliedFilters>({
    range: "30d",
    widgetId: null,
    agentId: null,
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
          throw new Error(payload?.error || t("analytics.loadError"));
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
          error instanceof Error ? error.message : t("analytics.loadError"),
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
  }, [effectiveFilters, showToast, t]);

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
  }, [showToast, state.detailCache, state.selectedWidgetSessionId, t]);

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
        throw new Error(payload?.error || t("analytics.loadMoreError"));
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

  return (
    <div className="flex h-screen w-full flex-col bg-surface overflow-hidden">
      {/* Header Strip: Operational Metrics */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">
            {t("analytics.operationalConsole")}
          </h1>
          <div className="h-4 w-[1px] bg-outline-variant/30" />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t("analytics.live")}</span>
              <span className="text-sm font-headline font-bold text-on-surface">
                {state.data?.conversations.length ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t("analytics.throughput")}</span>
              <span className="text-sm font-headline font-bold text-on-surface">
                {state.data?.overview.conversations ?? 0}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-success">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            <span className="text-[11px] font-bold tracking-tight">{t("analytics.systemOnline")}</span>
          </div>
        </div>
      </header>

      {/* Main Operational Body */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Pane 1: Live Intelligence Feed */}
        <aside className="w-[384px] shrink-0 border-r border-outline-variant/10 bg-surface-container-low/40">
          <ConversationInboxPane
            state={state}
            onSelectConversation={handleSelectConversation}
            onLoadMore={() => void loadMore()}
            onAgentSelect={(id) => setFilters(prev => ({ ...prev, agentId: id }))}
            selectedAgentId={filters.agentId}
          />
        </aside>

        {/* Pane 2: Transcript Canvas */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-surface">
          <ConversationDetail
            detail={state.selectedConversation}
            isLoading={state.isDetailLoading}
          />
          
        </section>

      </main>

      {isMobileDetailOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm lg:hidden">
          <div className="h-full w-full overflow-hidden rounded-3xl bg-surface">
            <ConversationDetail
              detail={state.selectedConversation}
              isLoading={state.isDetailLoading}
              onClose={() => setIsMobileDetailOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
