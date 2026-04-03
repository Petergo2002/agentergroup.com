"use client";

import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatRelativeDate } from "@/lib/utils";
import type { AgentRecord } from "@/lib/types";

interface AgentStatusListProps {
  agents: AgentRecord[];
  isLoading: boolean;
}

export function AgentStatusList({ agents, isLoading }: AgentStatusListProps) {
  const { language, t } = useLanguage();

  const getStatusConfig = (agent: AgentRecord) => {
    if (agent.archived_at) return { label: t("statuses.agent.archived"), classes: "bg-surface-container text-on-surface-variant/60" };
    if (agent.status === "active" && agent.published_version_id) return { label: t("statuses.agent.live"), classes: "bg-success/10 text-success" };
    if (agent.status === "active") return { label: t("statuses.agent.ready"), classes: "bg-primary/10 text-primary" };
    if (agent.status === "paused") return { label: t("statuses.agent.paused"), classes: "bg-surface-container text-on-surface-variant/70" };
    return { label: t("statuses.agent.draft"), classes: "bg-surface-container-high/40 text-on-surface-variant/40" };
  };

  return (
    <div className="rounded-[2rem] bg-surface-container-low/30 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] ring-1 ring-outline-variant/10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/5 text-primary mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest">{t("dashboard.inventory")}</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t("dashboard.agentStatus")}</h2>
        </div>
        <Link
          href="/agents"
          className="group flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container transition-all hover:bg-primary/10 hover:text-primary"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-surface-container-low/60"
            />
          ))
        ) : agents.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low/20">
            <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest">
              {t("dashboard.noAgentsYet")}
            </p>
          </div>
        ) : (
          agents.slice(0, 6).map((agent) => {
            const config = getStatusConfig(agent);
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}/builder`}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-surface-container-lowest/65 p-4 transition-all hover:bg-surface-container hover:shadow-lg hover:shadow-black/20 hover:ring-1 hover:ring-primary/10"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-on-surface uppercase tracking-tight">
                      {agent.name}
                    </p>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium">
                      {`${t("common.updated")} ${formatRelativeDate(agent.updated_at, language)}`}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${config.classes}`}>
                  {config.label}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
