"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Network,
  Settings,
  Database,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  userEmail?: string | null;
}

export function Sidebar({
  mobile = false,
  onNavigate,
  userEmail,
}: SidebarProps) {
  const pathname = usePathname();
  const { membership } = useAppContext();
  const initials = (userEmail ?? "AG").slice(0, 2).toUpperCase();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Widgets", href: "/widgets", icon: MessageSquare },
    { name: "Knowledge", href: "/knowledge", icon: Database },
    { name: "Connections", href: "/connections", icon: Network },
    { name: "Settings", href: "/settings", icon: Settings },
  ] satisfies Array<{ name: string; href: string; icon: LucideIcon }>;

  return (
    <aside
      className={`flex h-full flex-col text-on-surface ${
        mobile ? "bg-white shadow-2xl shadow-[#0f1728]/12" : "bg-transparent sticky top-0 h-screen w-[17rem] shrink-0"
      }`}
    >
      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher variant="sidebar-header" />
          </div>
          {mobile ? (
            <button
              aria-label="Close sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              onClick={onNavigate}
            >
              <X className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
      
      <nav className="mt-4 flex-1 space-y-1 px-4">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 ${
                isActive 
                  ? "bg-[#FF6B52]/10 text-on-surface" 
                  : "text-secondary hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-[#FF6B52]" />
              )}
              <Icon
                className={`h-[1.05rem] w-[1.05rem] shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-[#FF6B52]" : "text-on-surface-variant group-hover:text-on-surface"}`}
                strokeWidth={1.9}
              />
              <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#FF6B52]/18 bg-[#FF6B52]/8 text-xs font-bold text-[#FF6B52] shadow-sm ring-4 ring-[#FF6B52]/6">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-on-surface">
              {userEmail ?? "Workspace User"}
            </p>
            <div className="mt-0.5 inline-flex rounded-md bg-[#FF6B52]/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FF6B52]">
              {membership.role}
            </div>
          </div>
        </div>
        <form action="/auth/logout" method="post">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-2.5 text-xs font-bold text-on-surface-variant transition-all hover:border-[#FF6B52]/25 hover:bg-[#FF6B52]/6 hover:text-[#FF6B52] active:scale-[0.98]">
            <LogOut className="h-[1rem] w-[1rem]" strokeWidth={1.9} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
