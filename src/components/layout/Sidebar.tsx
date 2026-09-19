"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Network,
  Database,
  CircleHelp,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";
import { formatRelativeDate } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SELF_SERVE_BILLING_ENABLED } from "@/lib/billing-mode";
import { isMiloMode, isMiloNavItemActive } from "@/lib/milo/experience";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { BrandLogo } from "@/components/BrandLogo";
import { AvenroIcon } from "@/components/brand/AvenroIcon";

interface AnalyticsActivitySummary {
  agentName: string | null;
  widgetName: string;
  latestSnippet: string | null;
  lastActivityAt: string;
}

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  userEmail?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  analyticsHasNewActivity?: boolean;
  analyticsActivitySummary?: AnalyticsActivitySummary | null;
  newLeadCount?: number;
  openQuestionCount?: number;
  onClearAnalyticsActivity?: () => void;
  onClearLeads?: () => void;
  onClearQuestions?: () => void;
}

interface SidebarNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  brandIcon?: "milo";
  beta?: boolean;
  hasAttention?: boolean;
  attentionSummary?: AnalyticsActivitySummary | null;
  badgeCount?: number;
  /** Translation key describing the badge, e.g. "12 leads in the last 24 hours". */
  badgeLabelKey?: string;
  /** Marks this destination as seen. Runs when the item is clicked. */
  onSeen?: () => void;
}

export function Sidebar({
  mobile = false,
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  analyticsHasNewActivity = false,
  analyticsActivitySummary = null,
  newLeadCount = 0,
  openQuestionCount = 0,
  onClearAnalyticsActivity,
  onClearLeads,
  onClearQuestions,
}: SidebarProps) {
  const pathname = usePathname();
  const { membership, workspace, subscription } = useAppContext();
  const { t, language } = useLanguage();
  const internalAssistantsEnabled = hasInternalAssistantsEnabled(workspace);
  const miloMode = isMiloMode(
    workspace,
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false",
  );

  // Defensive check for subscription
  const messagesUsed = subscription?.messages_used ?? 0;
  const messagesLimit = subscription?.messages_limit ?? 50;
  const usagePercent = Math.min(
    Math.round((messagesUsed / messagesLimit) * 100),
    100
  );
  const isFreePlan = subscription?.plan_tier === "free";

  const classicNavGroups: Array<{ title: string; items: SidebarNavItem[] }> = [
    {
      title: t("nav.groups.overview"),
      items: [
        { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutGrid },
        {
          name: t("nav.analytics"),
          href: "/analytics",
          icon: BarChart3,
          hasAttention: analyticsHasNewActivity,
          attentionSummary: analyticsActivitySummary,
          onSeen: onClearAnalyticsActivity,
        },
        {
          name: t("nav.leads"),
          href: "/leads",
          icon: Users,
          badgeCount: newLeadCount,
          badgeLabelKey: "nav.newLeads",
          onSeen: onClearLeads,
        },
        {
          name: t("nav.questions"),
          href: "/questions",
          icon: CircleHelp,
          badgeCount: openQuestionCount,
          badgeLabelKey: "nav.newQuestions",
          onSeen: onClearQuestions,
        },
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
  const miloNavGroups: Array<{ title: string; items: SidebarNavItem[] }> = [
    {
      title: t("nav.groups.main"),
      items: [
        { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutGrid },
        { name: t("nav.milo"), href: "/milo", icon: Bot, brandIcon: "milo" },
        { name: t("nav.websiteChat"), href: "/website-chat", icon: MessageSquare },
      ],
    },
    {
      title: t("nav.groups.grow"),
      items: [
        { name: t("nav.knowledge"), href: "/knowledge", icon: Database },
        {
          name: t("nav.leads"),
          href: "/leads",
          icon: Users,
          badgeCount: newLeadCount,
          badgeLabelKey: "nav.newLeads",
          onSeen: onClearLeads,
        },
        {
          name: t("nav.improveMilo"),
          href: "/questions",
          icon: CircleHelp,
          badgeCount: openQuestionCount,
          badgeLabelKey: "nav.newQuestions",
          onSeen: onClearQuestions,
        },
        {
          name: t("nav.analytics"),
          href: "/analytics",
          icon: BarChart3,
          hasAttention: analyticsHasNewActivity,
          attentionSummary: analyticsActivitySummary,
          onSeen: onClearAnalyticsActivity,
        },
      ],
    },
    ...(subscription?.integrations_enabled
      ? [{ title: t("nav.groups.connect"), items: [{ name: t("nav.connections"), href: "/connections", icon: Network }] }]
      : []),
  ];
  const navGroups = miloMode ? miloNavGroups : classicNavGroups;

  // Alternating class names restart the cross-fade each time the panel is
  // toggled; see the .sidebar-content-a/-b note in globals.css.
  const contentFade = mobile
    ? ""
    : isCollapsed
      ? "sidebar-content-a"
      : "sidebar-content-b";

  return (
    <aside
      className={`depth-shell flex h-full flex-col text-on-surface ${
        mobile
          ? "bg-surface shadow-2xl shadow-black/40"
          : `sidebar-panel sticky top-0 h-screen shrink-0 border-r border-outline-variant/10 bg-surface-container-low ${
              isCollapsed ? "w-[60px]" : "w-[240px]"
            }`
      }`}
    >
      <div className={`px-4 pt-6 pb-4 flex flex-col items-center ${contentFade} ${isCollapsed && !mobile ? 'gap-6' : 'gap-5'}`}>
        <Link
          href="/"
          title={t("nav.backToLanding")}
          aria-label={t("nav.backToLanding")}
          className="group relative flex flex-col items-center shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-center shrink-0">
            {isCollapsed && !mobile ? (
              <AvenroIcon size={34} className="shrink-0 transition-transform duration-200 group-hover:scale-105" />
            ) : (
              <BrandLogo className="h-8 w-auto text-on-surface transition-transform duration-200 group-hover:scale-105" />
            )}
          </div>
        </Link>
        
        <div className={`flex ${isCollapsed && !mobile ? 'flex-col items-center gap-4' : 'items-center gap-3'}`}>
          <div className="flex shrink-0 items-center">
            <ThemeToggle />
          </div>

          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="depth-button flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container text-on-surface-variant transition-colors hover:border-primary/20 hover:bg-surface-container-high hover:text-on-surface"
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
              className="depth-button flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/10 bg-surface-container text-on-surface-variant transition-colors hover:border-primary/20 hover:bg-surface-container-high hover:text-on-surface"
              onClick={onNavigate}
            >
              <X className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      
      {/* A landmark with no name is announced as a bare "navigation", which
          tells a screen reader user nothing about which region they are in. */}
      <nav
        aria-label={t("nav.navigationLandmark")}
        className={`mt-2 flex-1 space-y-4 font-label ${contentFade} ${isCollapsed && !mobile ? 'px-2' : 'px-3'} overflow-y-auto overflow-x-hidden`}
      >
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1 relative">
            {(!isCollapsed || mobile) && (
              <h3 className="px-3 mb-1 text-[11px] font-semibold tracking-wider text-on-surface-variant/60">
                {group.title}
              </h3>
            )}
            {isCollapsed && !mobile && groupIndex > 0 && (
              <div className="mx-auto w-8 border-t border-outline-variant/10 my-3" />
            )}
            
            {group.items.map((item) => {
              const isActive = miloMode
                ? isMiloNavItemActive(pathname ?? "", item.href, workspace)
                : pathname?.startsWith(item.href);
              const Icon = item.icon;
              const hasAttention = Boolean(item.hasAttention && !isActive);
              const badgeCount = Math.max(0, item.badgeCount ?? 0);
              const hasBadge = Boolean(badgeCount > 0 && !isActive);
              const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);
              const badgeDescription = t(item.badgeLabelKey ?? "nav.newLeads", {
                count: badgeCount,
              });
              const attentionAgent =
                item.attentionSummary?.agentName || t("common.unknownAgent");
              const attentionWidget =
                item.attentionSummary?.widgetName || t("analytics.globalWidget");
              const attentionTime = item.attentionSummary?.lastActivityAt
                ? formatRelativeDate(item.attentionSummary.lastActivityAt, language)
                : null;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    onNavigate?.();
                    item.onSeen?.();
                  }}
                  aria-label={
                    isCollapsed && !mobile
                      ? `${item.name}${item.beta ? ` (${t("common.beta")})` : ""}${
                          hasAttention
                            ? ` (${t("nav.newAnalyticsActivity")}: ${attentionAgent}, ${attentionWidget})`
                            : ""
                        }${hasBadge ? ` (${badgeDescription})` : ""}`
                      : undefined
                  }
                  title={
                    isCollapsed && !mobile
                      ? `${item.name}${item.beta ? ` (${t("common.beta")})` : ""}${
                          hasAttention
                            ? ` (${t("nav.newAnalyticsActivity")}: ${attentionAgent}, ${attentionWidget})`
                            : ""
                        }${hasBadge ? ` (${badgeDescription})` : ""}`
                      : undefined
                  }
                  className={`depth-nav-item group relative flex items-center gap-3 rounded-lg border py-2 transition-all duration-200 ${
                    isCollapsed && !mobile ? 'justify-center px-0 mx-1' : 'px-3 mx-0'
                  } ${
                    isActive 
                      ? "depth-nav-item-active border-primary/15 bg-primary/[0.08] text-primary shadow-xs"
                      : "border-transparent text-on-surface-variant hover:border-outline-variant/12 hover:bg-on-surface/[0.04] hover:text-on-surface"
                  }`}
                >
                  {item.brandIcon === "milo" ? (
                    <MiloLogo
                      size={20}
                      glowing
                      className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? "scale-105" : "opacity-85 group-hover:opacity-100"}`}
                    />
                  ) : (
                    <Icon
                      className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary scale-105" : "text-on-surface-variant/70 group-hover:text-on-surface"}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  )}
                  {hasAttention && isCollapsed && !mobile ? (
                    <span className="sidebar-badge-enter absolute right-2.5 top-2.5 flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 ring-1 ring-orange-300/80" />
                    </span>
                  ) : null}
                  {hasBadge && isCollapsed && !mobile ? (
                    <span
                      className="sidebar-badge-enter app-selected-control absolute right-0.5 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-extrabold leading-none ring-2 ring-surface-container-low"
                      aria-hidden="true"
                    >
                      {badgeLabel}
                    </span>
                  ) : null}
                  {(!isCollapsed || mobile) && (
                    <span className="min-w-0 flex-1 overflow-hidden transition-colors duration-200">
                      <span className={`block truncate text-sm tracking-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                        {item.name}
                      </span>
                      {hasAttention ? (
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-bold leading-none text-orange-600 dark:text-orange-400">
                          <span className="truncate">{attentionAgent}</span>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-orange-400/70" />
                          <span className="truncate text-on-surface-variant/70">
                            {attentionWidget}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  )}
                  {hasAttention && (!isCollapsed || mobile) ? (
                    <span className="sidebar-badge-enter ml-2 flex h-2.5 w-2.5 shrink-0 relative" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 ring-1 ring-orange-300/80" />
                    </span>
                  ) : null}
                  {hasBadge && (!isCollapsed || mobile) ? (
                    <span
                      className="sidebar-badge-enter ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary ring-1 ring-primary/15"
                      aria-hidden="true"
                    >
                      {badgeLabel}
                    </span>
                  ) : null}
                  {hasBadge && (!isCollapsed || mobile) ? (
                    <span className="sr-only">{badgeDescription}</span>
                  ) : null}
                  {hasAttention ? (
                    <span className="sr-only">{t("nav.newAnalyticsActivity")}</span>
                  ) : null}
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
                    <div className="fixed left-[68px] max-w-[260px] rounded-lg bg-on-surface/95 backdrop-blur-md px-3 py-2 text-xs font-bold text-background opacity-0 shadow-2xl ring-1 ring-outline-variant pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 group-focus-visible:opacity-100 z-[9999]">
                      <div className="whitespace-nowrap">
                        {item.name}
                        {item.beta && ` (${t("common.beta")})`}
                      </div>
                      {hasAttention ? (
                        <div className="mt-1.5 space-y-1 font-medium text-background/70">
                          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-300">
                            {t("nav.newAnalyticsActivity")}
                            {attentionTime ? ` - ${attentionTime}` : ""}
                          </div>
                          <div className="truncate text-[11px] text-background">
                            {attentionAgent}
                          </div>
                          <div className="truncate text-[11px]">{attentionWidget}</div>
                          {item.attentionSummary?.latestSnippet ? (
                            <div className="line-clamp-2 max-w-[230px] text-[11px] leading-snug">
                              {item.attentionSummary.latestSnippet}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={`mt-auto pb-4 pt-2 space-y-2 ${contentFade} ${isCollapsed && !mobile ? 'px-2' : 'px-3'}`}>
        
        {/* Message Usage Bar */}
        {subscription && (
          <div className={`relative w-full ${isCollapsed && !mobile ? 'flex justify-center' : ''}`}>
            <div className={`depth-card group relative rounded-xl border border-outline-variant/10 bg-surface-container-high/40 transition-all ${isCollapsed && !mobile ? 'flex h-12 w-12 flex-col items-center justify-center p-0' : 'p-2.5 w-full'}`}>
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
                      date: formatLocaleDate(subscription.billing_cycle_end, language, { day: 'numeric', month: 'short' })
                    })}
                  </p>
                  {SELF_SERVE_BILLING_ENABLED && isFreePlan && (
                    <Link
                      href="/settings/billing"
                      onClick={onNavigate}
                      className="upgrade-btn-border group/upgrade mt-4 flex w-full items-center justify-center shadow-sm transition-all duration-300 hover:shadow-md"
                      aria-label="Upgrade plan"
                    >
                      {/* Inner button surface */}
                      <div className="relative flex h-10 w-full items-center justify-center gap-2.5 rounded-[10.5px] bg-surface-container-lowest transition-colors duration-300 group-hover/upgrade:bg-surface-container-lowest dark:bg-surface-container-low dark:group-hover/upgrade:bg-surface-container-high">
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
          <div className="depth-card group relative flex items-center gap-2.5 rounded-xl border border-primary/10 bg-primary/[0.02] px-2.5 py-2 transition-all duration-300 hover:border-primary/25 hover:bg-primary/[0.06]">
            {/* Ambient glowing background spotlight matching brand orange */}
            <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-primary/0 via-primary/[0.04] to-primary/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15">
              <Building2 className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[6deg]" />
            </div>

            <div className="relative z-10 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary ring-2 ring-primary/20 animate-pulse" />
                <p className="truncate text-[8px] font-extrabold uppercase tracking-[0.15em] text-primary/90">
                  {t("nav.guestWorkspace") || "Guest Workspace"}
                </p>
              </div>
              <p className="truncate text-[11px] font-bold text-on-surface-variant transition-colors mt-0.5 group-hover:text-on-surface">
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
