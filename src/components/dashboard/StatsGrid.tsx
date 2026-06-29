"use client";

import type { ComponentType } from "react";
import { useMemo } from "react";
import { Bot, Activity, BarChart3, Database } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface StatsGridProps {
  stats: {
    totalAgents: number;
    activeAgents: number;
    liveWidgets: number;
    connectedApps: number;
    knowledgeSources: number;
  };
  isLoading: boolean;
}

interface StatCardProps {
  item: {
    label: string;
    value: number;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    tone: string;
    description: string;
    meta: string;
  };
  isLoading: boolean;
}

function StatCard({ item, isLoading }: StatCardProps) {
  const Icon = item.icon;

  return (
    <article className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface-variant">
          {item.meta}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex min-h-9 items-baseline gap-2">
          <span className="font-headline text-3xl font-bold tabular-nums text-on-surface">
            {isLoading ? (
              <span className="block h-8 w-16 animate-pulse rounded-lg bg-surface-container" />
            ) : item.value}
          </span>
        </div>
        <h2 className="mt-1 text-sm font-semibold tracking-normal text-on-surface">
          {item.label}
        </h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-on-surface-variant/70">
          {item.description}
        </p>
      </div>
    </article>
  );
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { t } = useLanguage();
  const statItems = useMemo(
    () => [
      {
        label: t("dashboard.totalAgents"),
        value: stats.totalAgents,
        icon: Bot,
        tone: "bg-primary/10 text-primary",
        description: t("dashboard.agentsDescription", { active: stats.activeAgents }),
        meta: t("dashboard.activeAgentsMetric", { count: stats.activeAgents }),
      },
      {
        label: t("dashboard.liveWidgets"),
        value: stats.liveWidgets,
        icon: Activity,
        tone: "bg-success-container text-success",
        description: t("dashboard.widgetsDescription"),
        meta: t("common.live"),
      },
      {
        label: t("dashboard.connectedApps"),
        value: stats.connectedApps,
        icon: BarChart3,
        tone: "bg-surface-container text-on-surface",
        description: t("dashboard.appsDescription"),
        meta: t("common.connected"),
      },
      {
        label: t("dashboard.knowledge"),
        value: stats.knowledgeSources,
        icon: Database,
        tone: "bg-primary/10 text-primary",
        description: t("dashboard.knowledgeDescription"),
        meta: t("dashboard.sourcesMetric"),
      },
    ],
    [
      stats.activeAgents,
      stats.connectedApps,
      stats.knowledgeSources,
      stats.liveWidgets,
      stats.totalAgents,
      t,
    ],
  );

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => (
        <StatCard
          key={item.label}
          item={item}
          isLoading={isLoading}
        />
      ))}
    </section>
  );
}
