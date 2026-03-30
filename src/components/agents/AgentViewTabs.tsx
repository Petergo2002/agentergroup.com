"use client";

import Link from "next/link";

type AgentViewTab = "builder" | "preview";

interface AgentViewTabsProps {
  agentId: string;
  current: AgentViewTab;
}

const TABS: Array<{ key: AgentViewTab; label: string }> = [
  { key: "builder", label: "Builder" },
  { key: "preview", label: "Preview" },
];

export function AgentViewTabs({ agentId, current }: AgentViewTabsProps) {
  return (
    <nav className="inline-flex items-center gap-1 rounded-[14px] border border-outline-variant/10 bg-surface-container-low p-1 shadow-sm">
      {TABS.map((tab) => {
        const href = `/agents/${agentId}/${tab.key}`;
        const isCurrent = tab.key === current;

        return (
          <Link
            key={tab.key}
            href={href}
            className={`flex h-8 min-w-[80px] items-center justify-center rounded-[10px] px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
              isCurrent
                ? "bg-on-surface text-background shadow-md shadow-black/10 active:scale-95"
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
