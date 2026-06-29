"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { Activity, ArrowUpRight, Plus } from "lucide-react";

interface DashboardHeaderProps {
  userName?: string;
  onCreateAgent: () => void;
}

export function DashboardHeader({
  userName = "there",
  onCreateAgent,
}: DashboardHeaderProps) {
  const { t } = useLanguage();
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greetingMorning");
    if (hour < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  }, [t]);

  return (
    <header className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-5 shadow-sm sm:px-6 lg:px-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/8 px-2.5 py-1 text-primary">
            <Activity className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span className="text-xs font-semibold">{t("dashboard.commandCenter")}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
            {greeting}, <span className="text-primary">{userName}</span>.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
            {t("dashboard.overview")}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/analytics"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary/25 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("dashboard.viewAllAnalytics")}
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <button
            type="button"
            onClick={onCreateAgent}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            {t("dashboard.initializeAgent")}
          </button>
        </div>
      </div>
    </header>
  );
}
