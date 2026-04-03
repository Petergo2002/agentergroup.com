"use client";

import { useMemo } from "react";
import { Users, Activity, BarChart3, Database } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface StatsGridProps {
  stats: {
    activeAgents: number;
    liveWidgets: number;
    connectedApps: number;
    knowledgeSources: number;
    leads?: number;
  };
  isLoading: boolean;
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { t } = useLanguage();
  const statItems = useMemo(() => [
    { 
      label: t("dashboard.customerLeads"), 
      value: stats.leads ?? 0, 
      icon: Users, 
      color: "text-primary",
      description: t("dashboard.leadsDescription")
    },
    { 
      label: t("dashboard.liveWidgets"), 
      value: stats.liveWidgets, 
      icon: Activity, 
      color: "text-success",
      description: t("dashboard.widgetsDescription")
    },
    { 
      label: t("dashboard.connectedApps"), 
      value: stats.connectedApps, 
      icon: BarChart3, 
      color: "text-on-surface",
      description: t("dashboard.appsDescription")
    },
    { 
      label: t("dashboard.knowledge"), 
      value: stats.knowledgeSources, 
      icon: Database, 
      color: "text-primary",
      description: t("dashboard.knowledgeDescription")
    },
  ], [stats, t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {statItems.map((item, idx) => (
        <div 
          key={item.label} 
          className="group relative flex flex-col justify-between rounded-[2rem] bg-surface-container-low/55 p-6 ring-1 ring-outline-variant/10 shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-all hover:bg-surface-container hover:shadow-xl hover:shadow-black/20 hover:ring-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          <div className="flex items-start justify-between mb-6">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container group-hover:bg-primary/5 transition-colors`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            {isLoading && (
              <div className="h-4 w-12 bg-surface-container animate-pulse rounded-full" />
            )}
          </div>
          
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-headline font-bold text-on-surface">
                {isLoading ? "..." : item.value}
              </span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              {item.label}
            </p>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant/60 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
