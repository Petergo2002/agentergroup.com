import Link from "next/link";

export type AdminWorkspaceTab = "analytics" | "agents" | "widgets";

interface AdminTabsProps {
  currentTab: AdminWorkspaceTab;
  workspaceId: string;
}

const tabs: Array<{ key: AdminWorkspaceTab; label: string }> = [
  { key: "analytics", label: "Analytics" },
  { key: "agents", label: "Agents" },
  { key: "widgets", label: "Widgets" },
];

export function AdminTabs({ currentTab, workspaceId }: AdminTabsProps) {
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
