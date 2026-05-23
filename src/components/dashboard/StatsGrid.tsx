"use client";

import { useMemo, useRef, useState } from "react";
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
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    glowColor: string;
    description: string;
  };
  isLoading: boolean;
  idx: number;
}

function StatCard({ item, isLoading, idx }: StatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });
  };

  const Icon = item.icon;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-surface-container-low/60 p-6 ring-1 ring-outline-variant/10 shadow-sm transition-all duration-500 hover:bg-surface-container hover:shadow-premium hover:-translate-y-1 hover:ring-primary/20 animate-in fade-in slide-in-from-bottom-4"
      style={{
        animationDelay: `${idx * 100}ms`,
        animationFillMode: "both",
        // Pass the card's accent color custom variable
        ["--glow-color" as never]: item.glowColor
      }}
    >
      {/* Interactive, liquid radial spotlight glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[2rem] transition-opacity duration-500 opacity-0 group-hover:opacity-100"
        style={{
          background: `radial-gradient(280px circle at ${coords.x}px ${coords.y}px, color-mix(in srgb, var(--glow-color) 8%, transparent), transparent 80%)`,
        }}
      />

      <div className="relative z-10 flex items-start justify-between mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container/80 backdrop-blur-sm group-hover:bg-primary/5 transition-colors duration-300">
          <Icon className={`h-5 w-5 ${item.color} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`} />
        </div>
        {isLoading && (
          <div className="h-4 w-12 bg-surface-container animate-pulse rounded-full" />
        )}
      </div>

      <div className="relative z-10">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-headline font-bold text-on-surface">
            {isLoading ? "..." : item.value}
          </span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          {item.label}
        </p>
        <p className="mt-3 text-[11px] font-medium leading-relaxed text-on-surface-variant/60 opacity-0 transform translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out">
          {item.description}
        </p>
      </div>
    </div>
  );
}

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  const { t } = useLanguage();
  const statItems = useMemo(() => [
    {
      label: t("dashboard.agentStatus"),
      value: stats.totalAgents,
      icon: Bot,
      color: "text-primary",
      glowColor: "var(--primary)",
      description: t("dashboard.agentsDescription", { active: stats.activeAgents })
    },
    {
      label: t("dashboard.liveWidgets"),
      value: stats.liveWidgets,
      icon: Activity,
      color: "text-success",
      glowColor: "var(--success)",
      description: t("dashboard.widgetsDescription")
    },
    {
      label: t("dashboard.connectedApps"),
      value: stats.connectedApps,
      icon: BarChart3,
      color: "text-on-surface",
      glowColor: "var(--on-surface)",
      description: t("dashboard.appsDescription")
    },
    {
      label: t("dashboard.knowledge"),
      value: stats.knowledgeSources,
      icon: Database,
      color: "text-primary",
      glowColor: "var(--primary)",
      description: t("dashboard.knowledgeDescription")
    },
  ], [stats.activeAgents, stats.connectedApps, stats.knowledgeSources, stats.liveWidgets, stats.totalAgents, t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {statItems.map((item, idx) => (
        <StatCard
          key={item.label}
          item={item}
          isLoading={isLoading}
          idx={idx}
        />
      ))}
    </div>
  );
}
