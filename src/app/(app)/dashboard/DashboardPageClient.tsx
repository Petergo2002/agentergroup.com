"use client";

import { AppIcon } from "@/components/icons/AppIcon";
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
    activeAgents: initialData.agents.filter((agent) => !agent.archived_at && agent.status === "active").length,
    liveWidgets: initialData.workspaceSummary.liveWidgets,
    connectedApps: initialData.workspaceSummary.connectedApps,
    knowledgeSources: initialData.workspaceSummary.knowledgeSources,
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-12 lg:px-12 space-y-10 animate-in fade-in duration-1000">
      <DashboardHeader 
        userName={profile?.full_name?.split(" ")[0]} 
      />

      <StatsGrid stats={stats} isLoading={false} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <section className="lg:col-span-8 flex flex-col gap-6">
          <RecentActivity 
            conversations={initialData.recentConversations} 
            isLoading={false} 
          />
        </section>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-8">
            <AgentStatusList 
              agents={initialData.agents} 
              isLoading={false} 
            />
            
            <button
              onClick={() => openCreateAgent()}
              className="signature-gradient group relative flex h-[72px] items-center justify-between rounded-[2rem] px-8 text-sm font-bold shadow-premium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
            <div className="flex items-center gap-3">
                <AppIcon name="add_circle" className="h-5 w-5" />
                <span className="uppercase tracking-[0.18em]">{t("dashboard.initializeAgent")}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 backdrop-blur-sm transition-colors group-hover:bg-black/10">
                <AppIcon name="arrow_forward" className="h-4 w-4 text-black" />
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
