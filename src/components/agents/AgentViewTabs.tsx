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
    <nav className="inline-flex items-center rounded-full border border-outline-variant/15 bg-surface-container-lowest p-1">
      {TABS.map((tab) => {
        const href = `/agents/${agentId}/${tab.key}`;
        const isCurrent = tab.key === current;

        return (
          <Link
            key={tab.key}
            href={href}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              isCurrent
                ? "bg-on-surface text-background"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
