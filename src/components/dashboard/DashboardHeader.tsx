'use client';

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { ArrowUpRight } from "lucide-react";
import { CreateAgentDropdown } from "@/components/agents/CreateAgentDropdown";
import { useAppContext } from "@/components/app/AppContext";

interface DashboardHeaderProps {
  userName?: string;
  showCreateAgent?: boolean;
}

export function DashboardHeader({
  userName = "there",
  showCreateAgent = true,
}: DashboardHeaderProps) {
  const { t } = useLanguage();
  const { workspace } = useAppContext();
  const miloMode =
    workspace.product_experience === "milo" &&
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false";
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greetingMorning");
    if (hour < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  }, [t]);

  return (
    <header className="relative pb-2 pt-1 transition-all duration-300">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-on-surface sm:text-3xl">
            {greeting}, <span className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">{userName}</span>.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
            {miloMode ? t("dashboard.miloOverview") : t("dashboard.overview")}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/analytics"
            className="app-secondary-button group w-full sm:w-auto transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98]"
          >
            {t("dashboard.viewAllAnalytics")}
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
          </Link>
          {showCreateAgent ? (
            <CreateAgentDropdown buttonText={t("dashboard.initializeAgent")} />
          ) : null}
        </div>
      </div>
    </header>
  );
}
