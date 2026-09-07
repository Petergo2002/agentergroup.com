"use client";

import Link from "next/link";
import { Bot, Compass, Database, MessageSquare, CircleHelp } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useAppContext } from "@/components/app/AppContext";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AgentStatusList } from "@/components/dashboard/AgentStatusList";
import { MiloLogo } from "@/components/brand/MiloLogo";
import type { DashboardSummaryResponse } from "@/lib/types";

export default function DashboardPageClient({
  initialData,
}: {
  initialData: DashboardSummaryResponse;
}) {
  const { profile, workspace } = useAppContext();
  const { t } = useLanguage();
  const miloMode = workspace.product_experience === "milo" && process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false";

  const stats = {
    totalAgents: initialData.agents.filter((agent) => !agent.archived_at).length,
    activeAgents: initialData.agents.filter(
      (agent) => !agent.archived_at && agent.status === "active",
    ).length,
    liveWidgets: initialData.workspaceSummary.liveWidgets,
    connectedApps: initialData.workspaceSummary.connectedApps,
    knowledgeSources: initialData.workspaceSummary.knowledgeSources,
    leads: initialData.workspaceSummary.leads,
    unansweredQuestions: initialData.workspaceSummary.unansweredQuestions,
  };

  return (
    <div className="app-page">
      <DashboardHeader 
        userName={profile?.full_name?.split(" ")[0]}
        showCreateAgent={!miloMode}
      />

      <StatsGrid stats={stats} isLoading={false} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <RecentActivity
            conversations={initialData.recentConversations}
            isLoading={false}
          />
        </section>

        <section className="flex min-w-0 flex-col gap-6">
          {miloMode ? (
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-on-surface">
                {stats.unansweredQuestions > 0
                  ? t("dashboard.miloAttention")
                  : t("dashboard.miloUpToDate")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                {stats.unansweredQuestions > 0
                  ? t("dashboard.miloAttentionDescription")
                  : t("dashboard.miloUpToDateDescription")}
              </p>
              <div className="mt-4 grid gap-2">
                <Link href="/questions" className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs font-semibold hover:bg-surface-container-high"><CircleHelp className="h-4 w-4 text-primary" />{t("nav.improveMilo")}</Link>
                <Link href="/website-chat" className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs font-semibold hover:bg-surface-container-high"><MessageSquare className="h-4 w-4 text-primary" />{t("nav.websiteChat")}</Link>
              </div>
            </section>
          ) : <AgentStatusList agents={initialData.agents} isLoading={false} />}

          <section className="relative overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs transition-all duration-300 hover:border-primary/25">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Compass className="h-4.5 w-4.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-normal text-on-surface">
                  {t("nav.groups.overview")}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {miloMode ? t("dashboard.miloOverview") : t("dashboard.overview")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={miloMode ? "/milo" : "/agents"}
                className="flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary/20 hover:bg-surface-container-high"
              >
                {miloMode ? <MiloLogo size={18} className="h-[18px] w-[18px]" /> : <Bot className="h-4 w-4 text-primary" />}
                <span>{miloMode ? t("nav.milo") : t("nav.agents")}</span>
              </Link>
              <Link
                href="/knowledge"
                className="flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:border-primary/20 hover:bg-surface-container-high"
              >
                <Database className="h-4 w-4 text-primary" />
                <span>{t("nav.knowledge")}</span>
              </Link>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
