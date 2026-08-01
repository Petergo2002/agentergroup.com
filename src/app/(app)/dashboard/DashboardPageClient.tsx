"use client";

import { Plus } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useAppContext } from "@/components/app/AppContext";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AgentStatusList } from "@/components/dashboard/AgentStatusList";
import type { DashboardSummaryResponse } from "@/lib/types";

import { CreateAgentDropdown } from "@/components/agents/CreateAgentDropdown";

export default function DashboardPageClient({
  initialData,
}: {
  initialData: DashboardSummaryResponse;
}) {
  const { profile } = useAppContext();
  const { t } = useLanguage();

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
    <div className="app-page">
      <DashboardHeader 
        userName={profile?.full_name?.split(" ")[0]} 
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
          />

          <section className="app-card">
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
            <div className="mt-5 w-full">
              <CreateAgentDropdown buttonText={t("dashboard.initializeAgent")} buttonClassName="app-primary-button w-full justify-center" />
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
