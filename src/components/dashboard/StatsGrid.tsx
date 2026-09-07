"use client";

import type { ComponentType } from "react";
import { useMemo } from "react";
import { Activity, BarChart3, Bot, CircleHelp, Database, Users } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useAppContext } from "@/components/app/AppContext";

interface StatsGridProps {
  stats: {
    totalAgents: number;
    activeAgents: number;
    liveWidgets: number;
    connectedApps: number;
    knowledgeSources: number;
    leads: number;
    unansweredQuestions: number;
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
    <article className="group relative rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-container-low/70 hover:shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${item.tone}`}>
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-on-surface-variant transition-colors group-hover:border-primary/20 group-hover:text-on-surface">
          {item.meta}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex min-h-9 items-baseline gap-2">
          <span className="font-headline text-3xl font-extrabold tabular-nums text-on-surface tracking-tight">
            {isLoading ? (
              <span className="block h-8 w-16 animate-pulse rounded-lg bg-surface-container" />
            ) : item.value}
          </span>
        </div>
        <h2 className="mt-1 text-sm font-semibold tracking-normal text-on-surface">
          {item.label}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
          {item.description}
        </p>
      </div>
    </article>
  );
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { t } = useLanguage();
  const { workspace } = useAppContext();
  const miloMode = workspace.product_experience === "milo" && process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false";
  const statItems = useMemo(
    () => [
      {
        label: miloMode ? t("dashboard.leads") : t("dashboard.totalAgents"),
        value: miloMode ? stats.leads : stats.totalAgents,
        icon: miloMode ? Users : Bot,
        tone: "bg-primary/10 text-primary",
        description: miloMode ? t("dashboard.leadsDescription") : t("dashboard.agentsDescription", { active: stats.activeAgents }),
        meta: miloMode ? t("dashboard.capturedMetric") : t("dashboard.activeAgentsMetric", { count: stats.activeAgents }),
      },
      {
        label: miloMode ? t("dashboard.improveMilo") : t("dashboard.liveWidgets"),
        value: miloMode ? stats.unansweredQuestions : stats.liveWidgets,
        icon: miloMode ? CircleHelp : Activity,
        tone: "bg-success-container text-success",
        description: miloMode ? t("dashboard.improveMiloDescription") : t("dashboard.widgetsDescription"),
        meta: miloMode ? t("dashboard.openMetric") : t("common.live"),
      },
      {
        label: miloMode ? t("dashboard.connections") : t("dashboard.connectedApps"),
        value: stats.connectedApps,
        icon: BarChart3,
        tone: "bg-surface-container text-on-surface",
        description: miloMode ? t("dashboard.miloAppsDescription") : t("dashboard.appsDescription"),
        meta: t("common.connected"),
      },
      {
        label: t("dashboard.knowledge"),
        value: stats.knowledgeSources,
        icon: Database,
        tone: "bg-primary/10 text-primary",
        description: miloMode ? t("dashboard.miloKnowledgeDescription") : t("dashboard.knowledgeDescription"),
        meta: t("dashboard.sourcesMetric"),
      },
    ],
    [
      stats.activeAgents,
      stats.connectedApps,
      stats.knowledgeSources,
      stats.leads,
      stats.liveWidgets,
      stats.totalAgents,
      stats.unansweredQuestions,
      miloMode,
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
