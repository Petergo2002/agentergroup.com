"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

import type { AgentSurface } from "@/lib/types";
import { useAppContext } from "@/components/app/AppContext";

type AgentViewTab = "builder" | "preview" | "activity";

interface AgentViewTabsProps {
  agentId: string;
  current: AgentViewTab;
  surface?: AgentSurface | null;
}

export function AgentViewTabs({ agentId, current, surface }: AgentViewTabsProps) {
  const { t } = useLanguage();
  const { workspace } = useAppContext();
  const isPrimaryMilo =
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false" &&
    workspace.product_experience === "milo" &&
    workspace.primary_customer_agent_id === agentId;
  const tabs: Array<{ key: AgentViewTab; label: string }> =
    surface === "automation"
      ? [
          { key: "builder", label: t("agents.builder") },
          { key: "activity", label: t("agents.activity") },
        ]
      : [
          { key: "builder", label: t("agents.builder") },
          { key: "preview", label: isPrimaryMilo ? t("agents.testMilo") : t("agents.preview") },
        ];

  const [activeTab, setActiveTab] = useState<AgentViewTab>(current);

  useEffect(() => {
    setActiveTab(current);
  }, [current]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeTab),
  );

  return (
    <nav
      role="tablist"
      aria-label="Agent views"
      className="relative inline-flex items-center rounded-full p-1 isolate bg-surface-container-low/60 dark:bg-surface-container-lowest/50 backdrop-blur-xl backdrop-saturate-150 border border-outline-variant/15 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03),_inset_0_1px_1.5px_rgba(255,255,255,0.7)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all"
    >
      {/* Liquid Glass Sliding Thumb */}
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-gradient-to-b from-white/95 via-white/85 to-white/70 dark:from-white/[0.18] dark:via-white/[0.10] dark:to-white/[0.04] backdrop-blur-2xl backdrop-saturate-200 border border-white/90 dark:border-white/[0.22] shadow-[0_2px_10px_rgba(0,0,0,0.08),_0_1px_3px_rgba(0,0,0,0.04),_inset_0_1px_1.5px_rgba(255,255,255,1),_inset_0_-1px_1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5),_0_1px_3px_rgba(0,0,0,0.2),_inset_0_1px_1.5px_rgba(255,255,255,0.3),_inset_0_-1px_1px_rgba(0,0,0,0.3)]"
        style={{
          left: "4px",
          width: `calc((100% - 8px) / ${tabs.length})`,
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
      >
        {/* Specular Top Refraction Sheen */}
        <div className="absolute inset-x-3 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-95 dark:via-white/70" />

        {/* Subtle Ambient Liquid Warmth matching brand */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-primary/[0.08] via-primary/[0.02] to-transparent dark:from-primary/[0.16] dark:via-primary/[0.04]" />
      </div>

      {/* Tabs Container */}
      <div className="relative z-10 grid grid-flow-col auto-cols-fr items-center">
        {tabs.map((tab) => {
          const href = `/agents/${agentId}/${tab.key}`;
          const isCurrent = tab.key === activeTab;

          return (
            <Link
              key={tab.key}
              href={href}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={isCurrent}
              className={`relative z-10 flex h-8 min-w-[92px] sm:min-w-[104px] items-center justify-center rounded-full px-4 text-[10.5px] font-bold uppercase tracking-[0.18em] select-none transition-all duration-200 active:scale-[0.97] ${
                isCurrent
                  ? "text-primary dark:text-primary font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                  : "text-on-surface-variant/70 hover:text-on-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              }`}
            >
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
