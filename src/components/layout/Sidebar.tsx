"use client";

import Image from "next/image";
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
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  userEmail?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  mounted?: boolean;
}

export function Sidebar({
  mobile = false,
  onNavigate,
  userEmail,
  isCollapsed = false,
  onToggleCollapse,
  mounted = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { membership, workspace } = useAppContext();
  const { t } = useLanguage();
  const initials = (userEmail ?? "AG").slice(0, 2).toUpperCase();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);

  const navItems = [
    { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutGrid },
    { name: t("nav.analytics"), href: "/analytics", icon: BarChart3 },
    { name: t("nav.agents"), href: "/agents", icon: Bot },
    ...(internalAssistantsEnabled
      ? [{ name: t("nav.assistants"), href: "/assistants", icon: MessageCircle, beta: true }]
      : []),
    { name: t("nav.widgets"), href: "/widgets", icon: MessageSquare },
    { name: t("nav.knowledge"), href: "/knowledge", icon: Database },
    { name: t("nav.connections"), href: "/connections", icon: Network },
    { name: t("nav.settings"), href: "/settings", icon: Settings },
  ] satisfies Array<{ name: string; href: string; icon: LucideIcon; beta?: boolean }>;

  return (
    <aside
      className={`flex h-full flex-col text-on-surface transition-all duration-300 ease-in-out ${
        mobile
          ? "bg-surface shadow-2xl shadow-black/40"
          : `sticky top-0 h-screen shrink-0 border-r border-outline-variant/10 bg-surface-container-low transition-all duration-300 ease-in-out ${
              isCollapsed ? "w-[60px]" : "w-[240px]"
            }`
      }`}
    >
      <div className={`px-4 pt-8 pb-6 flex flex-col items-center transition-all duration-300 ${isCollapsed && !mobile ? 'gap-6' : 'gap-5'}`}>
        <Link href="/dashboard" className="group relative flex flex-col items-center shrink-0">
          <div className="flex items-center justify-center shrink-0">
            <Image
              src="/svgfavicon.svg"
              alt="Agentergroup"
              width={isCollapsed && !mobile ? 48 : 80}
              height={isCollapsed && !mobile ? 48 : 80}
              priority
              className={`shrink-0 object-contain transition-all duration-300 group-hover:scale-105 ${
                isCollapsed && !mobile ? 'h-12 w-12' : 'h-20 w-20'
              }`}
            />
          </div>
        </Link>
        
        <div className={`flex ${isCollapsed && !mobile ? 'flex-col items-center gap-4' : 'items-center gap-3'}`}>
          {mounted && (
            <div className="flex shrink-0 items-center">
              <ThemeToggle />
            </div>
          )}

          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              title={isCollapsed ? t("common.expand") : t("common.collapse")}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4.5 w-4.5" />
              ) : (
                <ChevronLeft className="h-4.5 w-4.5" strokeWidth={2} />
              )}
            </button>
          )}

          {mobile && (
            <button
              aria-label={t("common.close")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              onClick={onNavigate}
            >
              <X className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      
      <nav className={`mt-1 flex-1 space-y-1.5 font-label transition-all duration-300 ${isCollapsed && !mobile ? 'px-2' : 'px-4'}`}>
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl py-3 transition-all duration-200 ${
                isCollapsed && !mobile ? 'justify-center px-0' : 'px-4'
              } ${
                isActive 
                  ? "bg-surface-container-high text-on-surface shadow-sm ring-1 ring-primary/20" 
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              {isActive && (
                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary ${isCollapsed && !mobile ? 'hidden' : ''}`} />
              )}
              <Icon
                className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary" : "text-on-surface-variant/70 group-hover:text-primary"}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {(!isCollapsed || mobile) && (
                <span className={`text-sm tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300 ${isActive ? "font-bold" : "font-medium"}`}>
                  {item.name}
                </span>
              )}
              {(!isCollapsed || mobile) && item.beta ? (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${
                    isActive
                      ? "bg-primary/12 text-primary"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {t("common.beta")}
                </span>
              ) : null}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && !mobile && (
                <div className="fixed left-[70px] rounded-md bg-on-surface px-3 py-2 text-xs font-bold text-background opacity-0 shadow-xl ring-1 ring-outline-variant pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-[9999] whitespace-nowrap">
                  {item.name}
                  {item.beta && ` (${t("common.beta")})`}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto p-4 space-y-3 transition-all duration-300 ${isCollapsed && !mobile ? 'px-2' : 'px-4'}`}>
        
        {membership.role !== 'owner' && (!isCollapsed || mobile) && (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/8 ring-1 ring-amber-500/15 px-3 py-2.5">
            <span className="material-symbols-outlined text-base text-amber-500">domain</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {t("nav.guestWorkspace") || "Guest Workspace"}
              </p>
              <p className="truncate text-[11px] font-medium text-on-surface-variant mt-0.5">
                {workspace.name}
              </p>
            </div>
          </div>
        )}

        <WorkspaceSwitcher isCollapsed={isCollapsed} mobile={mobile} />
      </div>
    </aside>
  );
}
