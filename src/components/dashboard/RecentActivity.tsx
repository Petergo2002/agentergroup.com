"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, User } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatRelativeDate } from "@/lib/utils";

interface Conversation {
  widgetSessionId: string;
  widgetName: string;
  agentName?: string | null;
  agentLabel?: string | null;
  lastActivityAt: string;
  latestSnippet?: string | null;
}

interface RecentActivityProps {
  conversations: Conversation[];
  isLoading: boolean;
}

export function RecentActivity({ conversations, isLoading }: RecentActivityProps) {
  const { language, t } = useLanguage();

  return (
    <section className="app-card sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">{t("dashboard.liveActivity")}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-on-surface">
            {t("dashboard.recentConversations")}
          </h2>
        </div>
        <Link
          href="/analytics"
          className="app-secondary-button min-h-10 px-3"
        >
          {t("dashboard.viewAllAnalytics")}
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[88px] animate-pulse rounded-xl border border-outline-variant/10 bg-surface-container-low"
            />
          ))
        ) : conversations.length === 0 ? (
          <div className="app-empty-state px-5 py-10">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant/15">
              <MessageSquare className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold tracking-normal text-on-surface">
              {t("dashboard.noConversationsDetected")}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-on-surface-variant/70">
              {t("dashboard.noConversationsDescription")}
            </p>
          </div>
        ) : (
          conversations.slice(0, 5).map((convo) => (
            <Link
              key={convo.widgetSessionId}
              href="/analytics"
              className="group grid gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-container-low/60 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
                  <User className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold tracking-normal text-on-surface transition-colors group-hover:text-primary">
                      {convo.widgetName}
                    </h3>
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant transition-colors group-hover:bg-surface-container-high">
                      {convo.agentLabel || convo.agentName || t("common.unknownAgent")}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-on-surface-variant/75">
                    {convo.latestSnippet || t("dashboard.noRecentActivity")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-on-surface-variant sm:justify-end">
                <span className="h-2 w-2 rounded-full bg-success ring-2 ring-success/20 animate-pulse" aria-hidden="true" />
                <span>{formatRelativeDate(convo.lastActivityAt, language)}</span>
                <ArrowRight className="h-4 w-4 opacity-55 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary" />
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
