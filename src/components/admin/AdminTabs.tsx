"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export type AdminWorkspaceTab = "analytics" | "agents" | "widgets";

interface AdminTabsProps {
  currentTab: AdminWorkspaceTab;
  workspaceId: string;
}

export function AdminTabs({ currentTab, workspaceId }: AdminTabsProps) {
  const { t } = useLanguage();
  const tabs: Array<{ key: AdminWorkspaceTab; label: string }> = [
    { key: "analytics", label: t("admin.analytics") },
    { key: "agents", label: t("admin.agents") },
    { key: "widgets", label: t("admin.widgets") },
  ];

  return (
    <nav className="flex items-center gap-6 border-b border-[#1a1a1a]">
      {tabs.map((tab) => {
        const isActive = tab.key === currentTab;

        return (
          <Link
            key={tab.key}
            href={`/admin/workspaces/${workspaceId}?tab=${tab.key}`}
            className={`border-b px-1 py-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-[#FF5C00] text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
