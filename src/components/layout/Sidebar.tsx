"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  LayoutGrid,
  ArrowUpRight,
  MessageCircle,
  MessageSquare,
  Network,
  Database,
  X,
  ChevronLeft,
  ChevronRight,
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
}

export function Sidebar({
  mobile = false,
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { membership, workspace, subscription } = useAppContext();
  const { t, language } = useLanguage();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);

  // Defensive check for subscription
  const messagesUsed = subscription?.messages_used ?? 0;
  const messagesLimit = subscription?.messages_limit ?? 50;
  const usagePercent = Math.min(
    Math.round((messagesUsed / messagesLimit) * 100),
    100
  );
  const isFreePlan = subscription?.plan_tier === "free";

  const navGroups = [
    {
      title: t("nav.groups.overview"),
      items: [
        { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutGrid },
        { name: t("nav.analytics"), href: "/analytics", icon: BarChart3 },
      ],
    },
    {
      title: t("nav.groups.specialists"),
      items: [
        { name: t("nav.agents"), href: "/agents", icon: Bot },
        ...(internalAssistantsEnabled
          ? [{ name: t("nav.assistants"), href: "/assistants", icon: MessageCircle, beta: true }]
          : []),
        { name: t("nav.widgets"), href: "/widgets", icon: MessageSquare },
      ],
    },
    {
      title: t("nav.groups.data"),
      items: [
        { name: t("nav.knowledge"), href: "/knowledge", icon: Database },
        ...(subscription?.integrations_enabled
          ? [{ name: t("nav.connections"), href: "/connections", icon: Network }]
          : []),
      ],
    },
  ];

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
          <div className="flex shrink-0 items-center">
            <ThemeToggle />
          </div>

          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
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
      
      <nav className={`mt-1 flex-1 space-y-6 font-label transition-all duration-300 ${isCollapsed && !mobile ? 'px-2' : 'px-4'} overflow-y-auto overflow-x-hidden`}>
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1.5 relative">
            {(!isCollapsed || mobile) && (
              <h3 className="px-4 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/50">
                {group.title}
              </h3>
            )}
            {isCollapsed && !mobile && groupIndex > 0 && (
              <div className="mx-auto w-8 border-t border-outline-variant/10 my-4" />
            )}
            
            {group.items.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={
                    isCollapsed && !mobile
                      ? `${item.name}${item.beta ? ` (${t("common.beta")})` : ""}`
                      : undefined
                  }
                  title={
                    isCollapsed && !mobile
                      ? `${item.name}${item.beta ? ` (${t("common.beta")})` : ""}`
                      : undefined
                  }
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
                    <div className="fixed left-[70px] rounded-md bg-on-surface px-3 py-2 text-xs font-bold text-background opacity-0 shadow-xl ring-1 ring-outline-variant pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 z-[9999] whitespace-nowrap">
                      {item.name}
                      {item.beta && ` (${t("common.beta")})`}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={`mt-auto p-4 space-y-3 transition-all duration-300 ${isCollapsed && !mobile ? 'px-2' : 'px-4'}`}>
        
        {/* Message Usage Bar */}
        {subscription && (
          <div className={`relative w-full ${isCollapsed && !mobile ? 'flex justify-center' : ''}`}>
            <div className={`group relative rounded-xl border border-outline-variant/10 bg-surface-container-high/40 transition-all ${isCollapsed && !mobile ? 'flex h-12 w-12 flex-col items-center justify-center p-0' : 'p-3 w-full'}`}>
              {isCollapsed && !mobile ? (
                <>
                  <div className="flex items-center justify-center flex-1">
                    <MessageSquare className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${usagePercent > 90 ? 'text-error' : 'text-primary'}`} />
                  </div>
                  
                  {/* Progress bar at the bottom of the square */}
                  <div className="absolute bottom-2 left-2.5 right-2.5 h-1 rounded-full bg-surface-container overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${usagePercent > 90 ? 'bg-error' : 'bg-primary'}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  
                  {/* Tooltip for collapsed usage */}
                  <div className="fixed left-[70px] rounded-md bg-on-surface px-3 py-2 text-xs font-bold text-background opacity-0 shadow-xl ring-1 ring-outline-variant pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-[9999] whitespace-nowrap">
                    {t('settings.billing.messagesUsed', {
                      used: messagesUsed,
                      limit: messagesLimit
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {t('settings.billing.messages')}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface">
                      {messagesUsed}/{messagesLimit}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <div 
                      className={`h-full transition-all duration-500 ${usagePercent > 90 ? 'bg-error' : 'bg-primary'}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[9px] font-medium text-on-surface-variant leading-tight">
                    {t('settings.billing.messagesReset', {
                      date: new Date(subscription.billing_cycle_end).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', { day: 'numeric', month: 'short' })
                    })}
                  </p>
                  {isFreePlan && (
                    <Link
                      href="/settings/billing"
                      onClick={onNavigate}
                      className="upgrade-btn-border group/upgrade mt-4 flex w-full items-center justify-center shadow-sm transition-all duration-300 hover:shadow-md"
                      aria-label="Upgrade plan"
                    >
                      {/* Inner button surface */}
                      <div className="relative flex h-10 w-full items-center justify-center gap-2.5 rounded-[10.5px] bg-surface-container-lowest transition-colors duration-300 group-hover/upgrade:bg-surface-container-lowest dark:bg-surface-container-low dark:group-hover/upgrade:bg-surface-container-high">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-on-surface text-background shadow-sm transition-transform duration-300 group-hover/upgrade:scale-110">
                          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="text-sm font-bold text-on-surface">
                          Upgrade
                        </span>
                      </div>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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

        <WorkspaceSwitcher
          isCollapsed={isCollapsed}
          mobile={mobile}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}
