import {
  AlertCircle,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import type {
  WidgetConfig,
  WidgetConversationSummary,
  WidgetLanguage,
} from "../types";

const COPY = {
  en: {
    title: "Your conversations",
    subtitle: "Continue where you left off on this browser.",
    newChat: "New conversation",
    emptyTitle: "No conversations yet",
    emptyBody: "Start a conversation and it will be saved here for next time.",
    retry: "Try again",
    active: "Active",
    completed: "Ended",
    today: "Today",
    yesterday: "Yesterday",
    loading: "Loading conversations",
  },
  sv: {
    title: "Dina konversationer",
    subtitle: "Fortsätt där du slutade i den här webbläsaren.",
    newChat: "Ny konversation",
    emptyTitle: "Inga konversationer än",
    emptyBody: "Starta en konversation så sparas den här till nästa gång.",
    retry: "Försök igen",
    active: "Aktiv",
    completed: "Avslutad",
    today: "Idag",
    yesterday: "Igår",
    loading: "Laddar konversationer",
  },
};

function formatConversationDate(
  value: string,
  language: WidgetLanguage,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000,
  );
  const copy = COPY[language];

  if (dayDifference === 0) {
    return `${copy.today}, ${new Intl.DateTimeFormat(
      language === "sv" ? "sv-SE" : "en-US",
      { hour: "2-digit", minute: "2-digit" },
    ).format(date)}`;
  }

  if (dayDifference === 1) return copy.yesterday;

  return new Intl.DateTimeFormat(language === "sv" ? "sv-SE" : "en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}

export function ConversationList({
  config,
  language,
  conversations,
  isLoading,
  error,
  onRetry,
  onSelect,
  onStartNew,
  openingSessionId = null,
}: {
  config: WidgetConfig;
  language: WidgetLanguage;
  conversations: WidgetConversationSummary[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (conversation: WidgetConversationSummary) => void;
  onStartNew: () => void;
  openingSessionId?: string | null;
}) {
  const copy = COPY[language];
  const agentById = new Map(
    config.agents.map((agent) => [agent.widgetAgentId, agent]),
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="flex h-full min-h-0 flex-col px-5 pb-5 pt-1 sm:px-6"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-widget-fg sm:text-xl">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-widget-muted">
            {copy.subtitle}
          </p>
        </div>
        {!isLoading && !error && conversations.length > 0 ? (
          <button
            type="button"
            onClick={onStartNew}
            aria-label={copy.newChat}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-widget-primary px-3 text-xs font-bold text-widget-primary-fg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-widget-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-widget-bg"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">{copy.newChat}</span>
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2 scrollbar-hide">
        {isLoading ? (
          <div
            className="overflow-hidden rounded-2xl border border-widget-border bg-widget-card/70"
            role="status"
            aria-label={copy.loading}
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 border-b border-widget-border/70 px-4 py-4 last:border-b-0"
              >
                <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-widget-state-hover" />
                <span className="min-w-0 flex-1 space-y-2.5">
                  <span className="block h-3 w-3/5 animate-pulse rounded-full bg-widget-state-hover" />
                  <span className="block h-2.5 w-4/5 animate-pulse rounded-full bg-widget-state-hover" />
                  <span className="block h-2 w-2/5 animate-pulse rounded-full bg-widget-state-hover" />
                </span>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-widget-border bg-widget-card/70 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-widget-accent-soft text-widget-primary">
              <AlertCircle className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-widget-fg">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-xl border border-widget-border bg-widget-bg px-3 py-2 text-xs font-semibold text-widget-fg transition-colors hover:bg-widget-state-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-widget-primary/50"
              >
                {copy.retry}
              </button>
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-7 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-widget-accent-soft text-widget-primary">
              <MessageSquare className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-base font-bold tracking-tight text-widget-fg">
              {copy.emptyTitle}
            </h3>
            <p className="mt-2 max-w-64 text-sm leading-5 text-widget-muted">
              {copy.emptyBody}
            </p>
            <button
              type="button"
              onClick={onStartNew}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-widget-primary px-4 text-xs font-bold text-widget-primary-fg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-widget-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-widget-bg"
            >
              <Plus className="h-4 w-4" />
              {copy.newChat}
            </button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-widget-border bg-widget-card/70">
            {conversations.map((conversation) => {
              const agent = conversation.widgetAgentId
                ? agentById.get(conversation.widgetAgentId)
                : null;
              const statusLabel =
                conversation.status === "active" ? copy.active : copy.completed;
              const isOpening = openingSessionId === conversation.sessionId;

              return (
                <li
                  key={conversation.sessionId}
                  className="border-b border-widget-border/70 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-widget-state-hover focus:outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-widget-primary/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-widget-accent-soft text-widget-primary transition-transform group-hover:scale-[1.03]">
                      <MessageSquare className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold text-widget-fg">
                          {conversation.title}
                        </span>
                        <span className="shrink-0 text-[10px] font-medium text-widget-muted">
                          {formatConversationDate(conversation.updatedAt, language)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-widget-muted">
                        {conversation.preview || agent?.label || config.brand.name}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-widget-muted">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            conversation.status === "active"
                              ? "bg-widget-primary"
                              : "bg-widget-muted/50"
                          }`}
                          aria-hidden="true"
                        />
                        <span>{statusLabel}</span>
                        {agent?.label ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{agent.label}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    {isOpening ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-widget-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-widget-muted/70 transition-transform group-hover:translate-x-0.5 group-hover:text-widget-fg" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
