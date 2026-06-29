"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useModals } from "@/components/ui/ModalProvider";
import { useAppContext } from "@/components/app/AppContext";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AgentStatusList } from "@/components/dashboard/AgentStatusList";
import type { DashboardSummaryResponse } from "@/lib/types";

export default function DashboardPageClient({
  initialData,
}: {
  initialData: DashboardSummaryResponse;
}) {
  const { profile } = useAppContext();
  const { t } = useLanguage();
  const { openCreateAgent } = useModals();

  const stats = {
    totalAgents: initialData.agents.filter((agent) => !agent.archived_at).length,
    activeAgents: initialData.agents.filter(
      (agent) => !agent.archived_at && agent.status === "active",
    ).length,
    liveWidgets: initialData.workspaceSummary.liveWidgets,
    connectedApps: initialData.workspaceSummary.connectedApps,
    knowledgeSources: initialData.workspaceSummary.knowledgeSources,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <DashboardHeader 
        userName={profile?.full_name?.split(" ")[0]} 
        onCreateAgent={openCreateAgent}
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
          <AgentStatusList
            agents={initialData.agents}
            isLoading={false}
            onCreateAgent={openCreateAgent}
          />

          <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-normal text-on-surface">
                  {t("dashboard.createAgentTitle")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant/75">
                  {t("dashboard.createAgentDescription")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreateAgent()}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
            >
              {t("dashboard.initializeAgent")}
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </section>
        </section>
      </div>
    </div>
  );
}
