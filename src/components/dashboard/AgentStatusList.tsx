"use client";

import Link from "next/link";
import { Bot, ChevronRight, Plus } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatRelativeDate } from "@/lib/utils";
import type { AgentRecord } from "@/lib/types";

interface AgentStatusListProps {
  agents: AgentRecord[];
  isLoading: boolean;
  onCreateAgent?: () => void;
}

export function AgentStatusList({
  agents,
  isLoading,
  onCreateAgent,
}: AgentStatusListProps) {
  const { language, t } = useLanguage();

  const getStatusConfig = (agent: AgentRecord) => {
    if (agent.archived_at) {
      return {
        label: t("statuses.agent.archived"),
        classes: "bg-surface-container text-on-surface-variant ring-outline-variant/15",
      };
    }

    if (agent.status === "active" && agent.published_version_id) {
      return {
        label: t("statuses.agent.live"),
        classes: "bg-success-container text-success ring-success/20",
      };
    }

    if (agent.status === "active") {
      return {
        label: t("statuses.agent.ready"),
        classes: "bg-primary/10 text-primary ring-primary/15",
      };
    }

    if (agent.status === "paused") {
      return {
        label: t("statuses.agent.paused"),
        classes: "bg-surface-container text-on-surface-variant ring-outline-variant/15",
      };
    }

    return {
      label: t("statuses.agent.draft"),
      classes: "bg-surface-container-low text-on-surface-variant ring-outline-variant/15",
    };
  };

  return (
    <section className="app-card sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">{t("dashboard.inventory")}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-on-surface">
            {t("dashboard.agentStatus")}
          </h2>
        </div>
        <Link
          href="/agents"
          aria-label={t("dashboard.viewAgents")}
          className="app-secondary-button min-h-10 px-3"
        >
          {t("common.view")}
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[72px] animate-pulse rounded-xl border border-outline-variant/10 bg-surface-container-low"
            />
          ))
        ) : agents.length === 0 ? (
          <div className="app-empty-state px-5 py-8">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant/15">
              <Bot className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold tracking-normal text-on-surface">
              {t("dashboard.noAgentsYet")}
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant/70">
              {t("dashboard.noAgentsDescription")}
            </p>
            {onCreateAgent ? (
              <button
                type="button"
                onClick={onCreateAgent}
                className="app-primary-button mt-5 min-h-10"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                {t("dashboard.initializeAgent")}
              </button>
            ) : null}
          </div>
        ) : (
          agents.slice(0, 6).map((agent) => {
            const config = getStatusConfig(agent);
            const isLive = agent.status === "active" && Boolean(agent.published_version_id);
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}/builder`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3.5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-container-low/60 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
                    <Bot className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold tracking-normal text-on-surface transition-colors group-hover:text-primary">
                      {agent.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-on-surface-variant/65">
                      {`${t("common.updated")} ${formatRelativeDate(agent.updated_at, language)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.classes}`}
                  >
                    {isLive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    )}
                    {config.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-on-surface-variant/45 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-on-surface-variant" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
