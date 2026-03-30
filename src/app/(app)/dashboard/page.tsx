"use client";

import { useEffect, useState } from "react";
import { useModals } from "@/components/ui/ModalProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { useAppContext } from "@/components/app/AppContext";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AgentStatusList } from "@/components/dashboard/AgentStatusList";
import type { DashboardSummaryResponse } from "@/lib/types";

interface DashboardState {
  isLoading: boolean;
  data: DashboardSummaryResponse | null;
}

export default function DashboardPage() {
  const { profile } = useAppContext();
  const { openCreateAgent } = useModals();
  const { showToast } = useToast();
  const [state, setState] = useState<DashboardState>({
    isLoading: true,
    data: null,
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      setState({ isLoading: true, data: null });

      try {
        const response = await fetch("/api/dashboard/summary", {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Failed to load dashboard overview.");
        }

        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          data: payload as DashboardSummaryResponse,
        });
      } catch (error) {
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard overview.",
          "error",
        );
        setState({
          isLoading: false,
          data: null,
        });
      }
    };

    void load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showToast]);

  const stats = {
    activeAgents: state.data?.agents.filter(a => !a.archived_at && a.status === "active").length ?? 0,
    liveWidgets: state.data?.workspaceSummary.liveWidgets ?? 0,
    connectedApps: state.data?.workspaceSummary.connectedApps ?? 0,
    knowledgeSources: state.data?.workspaceSummary.knowledgeSources ?? 0,
    leads: 0, // Defaulting to 0 as requested by the user
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-12 lg:px-12 space-y-10 animate-in fade-in duration-1000">
      <DashboardHeader 
        userName={profile?.full_name?.split(" ")[0]} 
      />

      <StatsGrid stats={stats} isLoading={state.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <section className="lg:col-span-8 flex flex-col gap-6">
          <RecentActivity 
            conversations={state.data?.recentConversations ?? []} 
            isLoading={state.isLoading} 
          />
        </section>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-8">
            <AgentStatusList 
              agents={state.data?.agents ?? []} 
              isLoading={state.isLoading} 
            />
            
            <button
              onClick={() => openCreateAgent()}
              className="signature-gradient group relative flex h-[72px] items-center justify-between rounded-[2rem] px-8 text-sm font-bold text-white shadow-xl shadow-primary/15 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span className="uppercase tracking-[0.18em]">Initialize New Agent</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
