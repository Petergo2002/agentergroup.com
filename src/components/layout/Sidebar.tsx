"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  LayoutGrid,
  LogOut,
  MessageCircle,
  MessageSquare,
  Network,
  Settings,
  Database,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";

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
  const { membership, workspace } = useAppContext();
  const initials = (userEmail ?? "AG").slice(0, 2).toUpperCase();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Agents", href: "/agents", icon: Bot },
    ...(internalAssistantsEnabled
      ? [{ name: "Assistants", href: "/assistants", icon: MessageCircle }]
      : []),
    { name: "Widgets", href: "/widgets", icon: MessageSquare },
    { name: "Knowledge", href: "/knowledge", icon: Database },
    { name: "Connections", href: "/connections", icon: Network },
    { name: "Settings", href: "/settings", icon: Settings },
  ] satisfies Array<{ name: string; href: string; icon: LucideIcon }>;

  return (
    <aside
      className={`flex h-full flex-col text-on-surface transition-colors duration-300 ${
        mobile
          ? "bg-surface shadow-2xl shadow-on-background/12"
          : "sticky top-0 h-screen w-64 shrink-0 bg-surface-container-low"
      }`}
    >
      <div className="px-6 py-8">
        <Link href="/dashboard" className="group relative flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Bot className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline text-xl font-bold leading-none tracking-tight text-on-surface">
              Agentergroup
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">
              AI Workspace
            </p>
          </div>
          {mobile ? (
            <button
              aria-label="Close sidebar"
              className="absolute -right-2 top-0 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              onClick={onNavigate}
            >
              <X className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          ) : null}
        </Link>
      </div>
      
      <nav className="mt-2 flex-1 space-y-1.5 px-4 font-label">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isActive 
                  ? "bg-surface-container-lowest text-primary shadow-sm ring-1 ring-outline-variant" 
                  : "text-on-surface-variant hover:bg-surface-container-lowest/50 hover:text-on-surface"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary-container" />
              )}
              <Icon
                className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary-container" : "text-on-surface-variant/70 group-hover:text-on-surface"}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-sm tracking-tight ${isActive ? "font-bold" : "font-medium"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="group relative flex w-full items-center gap-3 rounded-2xl bg-surface-container-lowest/40 p-3 ring-1 ring-transparent transition-all hover:bg-surface-container-lowest hover:ring-outline-variant">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant transition-colors group-hover:bg-primary-container/10 group-hover:text-primary-container">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-on-surface">
              {userEmail ?? "Workspace User"}
            </p>
            <div className="mt-1 inline-flex rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
              {membership.role}
            </div>
          </div>
          
          <form action="/auth/logout" method="post" className="absolute right-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button 
              type="submit"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error"
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
