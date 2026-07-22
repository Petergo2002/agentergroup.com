"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

import type { AgentSurface } from "@/lib/types";

type AgentViewTab = "builder" | "preview" | "activity";

interface AgentViewTabsProps {
  agentId: string;
  current: AgentViewTab;
  surface?: AgentSurface | null;
}

export function AgentViewTabs({ agentId, current, surface }: AgentViewTabsProps) {
  const { t } = useLanguage();
  const tabs: Array<{ key: AgentViewTab; label: string }> =
    surface === "automation"
      ? [
          { key: "builder", label: t("agents.builder") },
          { key: "activity", label: t("agents.activity") },
        ]
      : [
          { key: "builder", label: t("agents.builder") },
          { key: "preview", label: t("agents.preview") },
        ];

  return (
    <nav className="inline-flex items-center gap-1 rounded-[14px] border border-outline-variant/10 bg-surface-container-low p-1 shadow-sm">
      {tabs.map((tab) => {
        const href = `/agents/${agentId}/${tab.key}`;
        const isCurrent = tab.key === current;

        return (
          <Link
            key={tab.key}
            href={href}
            className={`flex h-8 min-w-[80px] items-center justify-center rounded-[10px] px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
              isCurrent
                ? "app-selected-control active:scale-95"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:scale-95"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
