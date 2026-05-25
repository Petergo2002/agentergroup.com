"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export type AdminWorkspaceTab = "customer" | "analytics" | "agents" | "widgets";

interface AdminTabsProps {
  currentTab: AdminWorkspaceTab;
  workspaceId: string;
}

export function AdminTabs({ currentTab, workspaceId }: AdminTabsProps) {
  const { t } = useLanguage();
  const tabs: Array<{ key: AdminWorkspaceTab; label: string }> = [
    { key: "customer", label: t("admin.customer") },
    { key: "analytics", label: t("admin.analytics") },
    { key: "agents", label: t("admin.agents") },
    { key: "widgets", label: t("admin.widgets") },
  ];

  return (
    <nav className="flex items-center gap-6 border-b border-outline">
      {tabs.map((tab) => {
        const isActive = tab.key === currentTab;

        return (
          <Link
            key={tab.key}
            href={`/admin/workspaces/${workspaceId}?tab=${tab.key}`}
            className={`border-b px-1 py-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-[#FF5C00] text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
