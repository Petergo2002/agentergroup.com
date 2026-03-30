"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";

interface DashboardHeaderProps {
  userName?: string;
}

export function DashboardHeader({ userName = "there" }: DashboardHeaderProps) {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="max-w-xl">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/5 text-primary mb-5">
          <Activity className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Command Center</span>
        </div>
        <h1 className="font-headline text-[2.75rem] font-bold leading-[1.05] text-on-surface tracking-tight">
          {greeting}, <span className="text-primary-orange">{userName}</span>.
        </h1>
        <p className="mt-5 text-[14px] font-medium leading-relaxed text-on-surface-variant/70 max-w-md">
          Your AI workspace is performing at capacity. Here&apos;s a quick overview of your 
          active agents and customer touchpoints.
        </p>
      </div>
    </header>
  );
}
