"use client";

import Image from "next/image";
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
  const { profile, membership, workspace } = useAppContext();
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
        mobile
          ? "bg-white shadow-2xl shadow-[#0f1728]/12"
          : "sticky top-0 h-screen w-[17rem] shrink-0 border-r border-outline-variant/20 bg-white"
      }`}
    >
      <div className="px-6 py-5">
        <div className="relative">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start gap-3 py-2 pl-1 pr-10">
              <Image
                src="/2.png"
                alt="Agentergroup"
                width={58}
                height={58}
                className="shrink-0 object-contain"
              />
              <div className="min-w-0">
                <div className="text-[18px] font-semibold tracking-tight text-on-surface">
                  Agentergroup
                </div>
                <div className="mt-1 text-[13px] font-medium text-on-surface-variant/75">
                  {profile.full_name?.trim() || workspace.name}
                </div>
              </div>
            </div>
          </div>
          {mobile ? (
            <button
              aria-label="Close sidebar"
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
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
        <div className="group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:bg-surface-container-low hover:border-outline-variant/20">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-variant text-xs font-bold text-on-surface-variant shadow-sm transition-colors group-hover:bg-[#FF6B52]/10 group-hover:text-[#FF6B52]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-on-surface">
              {userEmail ?? "Workspace User"}
            </p>
            <div className="mt-0.5 inline-flex rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {membership.role}
            </div>
          </div>
          
          <form action="/auth/logout" method="post" className="absolute right-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button 
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
