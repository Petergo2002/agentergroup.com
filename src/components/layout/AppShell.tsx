"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import useSWR, { SWRConfig } from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ModalProvider } from "@/components/ui/ModalProvider";
import { AppContextProvider } from "@/components/app/AppContext";
import { jsonFetcher, workspaceSWRKey } from "@/lib/json-fetcher";
import {
  markSeenNow,
  readSeenAt,
  readSeenAtOnServer,
  subscribeToSeenAt,
} from "@/lib/seen-at-store";
import type {
  AppWorkspaceContext,
  DashboardLatestActivityResponse,
} from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  context: AppWorkspaceContext;
  user: {
    id: string;
    email: string | null;
  };
}

const ANALYTICS_ACTIVITY_SEEN_PREFIX = "agenter_analytics_last_seen_at";
const LEADS_ACTIVITY_SEEN_PREFIX = "agenter_leads_last_seen_at";
const QUESTIONS_ACTIVITY_SEEN_PREFIX = "agenter_questions_last_seen_at";

export function AppShell({ children, context, user }: AppShellProps) {
  const { t } = useLanguage();
  const analyticsStorageKey = `${ANALYTICS_ACTIVITY_SEEN_PREFIX}:${context.workspace.id}`;
  const leadsStorageKey = `${LEADS_ACTIVITY_SEEN_PREFIX}:${context.workspace.id}`;
  const questionsStorageKey = `${QUESTIONS_ACTIVITY_SEEN_PREFIX}:${context.workspace.id}`;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("agenter_sidebar_collapsed") === "true",
  );
  const { data: latestActivityData } = useSWR<DashboardLatestActivityResponse>(
    workspaceSWRKey(
      user.id,
      context.workspace.id,
      "/api/dashboard/latest-activity",
    ),
    jsonFetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    },
  );
  const lastSeenAnalyticsActivityAt = useSyncExternalStore(
    subscribeToSeenAt,
    () => readSeenAt(analyticsStorageKey),
    readSeenAtOnServer,
  );
  const lastSeenLeadsAt = useSyncExternalStore(
    subscribeToSeenAt,
    () => readSeenAt(leadsStorageKey),
    readSeenAtOnServer,
  );
  const lastSeenQuestionsAt = useSyncExternalStore(
    subscribeToSeenAt,
    () => readSeenAt(questionsStorageKey),
    readSeenAtOnServer,
  );
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const toggleSidebarCollapse = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem("agenter_sidebar_collapsed", String(newState));
  };

  const closeMobileSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
  }, []);

  const openMobileSidebar = useCallback(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setIsSidebarOpen(true);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const drawer = mobileDrawerRef.current;
    if (!drawer) return;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const getFocusableElements = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("aria-hidden"),
      );

    const focusableElements = getFocusableElements();
    (focusableElements[0] ?? drawer).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileSidebar();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeMobileSidebar, isSidebarOpen]);

  const pathname = usePathname();
  // Identity-stable so the 60s activity poll does not re-render every consumer.
  const appContextValue = useMemo(
    () => ({ ...context, user }),
    [context, user],
  );
  const isAnalyticsRoute = pathname.startsWith("/analytics");
  const isLeadsRoute = pathname.startsWith("/leads");
  const isQuestionsRoute = pathname.startsWith("/questions");
  const primaryWebsiteChatPath =
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false" &&
    context.workspace.product_experience === "milo" &&
    context.workspace.primary_widget_id
    ? `/widgets/${context.workspace.primary_widget_id}`
    : null;
  const isFocusedAppRoute =
    /^\/agents\/[^/]+\/(builder|preview|activity)$/.test(pathname) ||
    pathname === "/milo" ||
    pathname === "/website-chat" ||
    pathname === primaryWebsiteChatPath ||
    /^\/widgets\/[^/]+\/preview$/.test(pathname) ||
    /^\/assistants\/[^/]+$/.test(pathname);

  const latestAnalyticsConversation = latestActivityData?.latestConversation ?? null;
  const rawLeadCount = latestActivityData?.newLeadCount ?? 0;
  const latestLeadCreatedAt = latestActivityData?.latestLeadCreatedAt ?? null;
  const rawOpenQuestionCount = latestActivityData?.openQuestionCount ?? 0;
  const latestQuestionCreatedAt =
    latestActivityData?.latestQuestionCreatedAt ?? null;
  const latestAnalyticsActivityAt = latestAnalyticsConversation?.lastActivityAt ?? null;

  const hasNewAnalyticsActivity =
    !isAnalyticsRoute &&
    Boolean(
      latestAnalyticsActivityAt &&
        (!lastSeenAnalyticsActivityAt ||
          latestAnalyticsActivityAt > lastSeenAnalyticsActivityAt),
    );

  const hasNewLeads =
    !isLeadsRoute &&
    rawLeadCount > 0 &&
    Boolean(
      !lastSeenLeadsAt ||
        (latestLeadCreatedAt && latestLeadCreatedAt > lastSeenLeadsAt),
    );

  const effectiveNewLeadCount = hasNewLeads ? rawLeadCount : 0;

  // The badge shows the whole open backlog, but only surfaces once something
  // has arrived since the operator last opened Improve Milo — otherwise a queue
  // they have already triaged would nag forever.
  const hasNewQuestions =
    !isQuestionsRoute &&
    rawOpenQuestionCount > 0 &&
    Boolean(
      !lastSeenQuestionsAt ||
        (latestQuestionCreatedAt && latestQuestionCreatedAt > lastSeenQuestionsAt),
    );

  const effectiveOpenQuestionCount = hasNewQuestions ? rawOpenQuestionCount : 0;

  // Mark "seen up to this item" using the timestamp the server reported, not
  // the browser clock. Those are different clocks: a client running even two
  // minutes slow stamps a seen time older than a lead that already exists, so
  // the badge survives the click and comes straight back — which is exactly the
  // confusing behaviour these badges are supposed to avoid. Anchoring on the
  // server value also keeps both sides of the comparison in one timestamp
  // format. Falls back to now only when there is nothing to anchor to.
  const clearAnalyticsAttention = useCallback(() => {
    markSeenNow(analyticsStorageKey, latestAnalyticsActivityAt ?? undefined);
  }, [analyticsStorageKey, latestAnalyticsActivityAt]);

  const clearLeadsBadge = useCallback(() => {
    markSeenNow(leadsStorageKey, latestLeadCreatedAt ?? undefined);
  }, [leadsStorageKey, latestLeadCreatedAt]);

  const clearQuestionsBadge = useCallback(() => {
    markSeenNow(questionsStorageKey, latestQuestionCreatedAt ?? undefined);
  }, [questionsStorageKey, latestQuestionCreatedAt]);

  // Re-runs when a newer item lands while the route is open, so something that
  // arrives while you are reading it does not badge the moment you navigate away.
  useEffect(() => {
    if (!isAnalyticsRoute) return;
    markSeenNow(analyticsStorageKey, latestAnalyticsActivityAt ?? undefined);
  }, [isAnalyticsRoute, analyticsStorageKey, latestAnalyticsActivityAt]);

  useEffect(() => {
    if (!isLeadsRoute) return;
    markSeenNow(leadsStorageKey, latestLeadCreatedAt ?? undefined);
  }, [isLeadsRoute, leadsStorageKey, latestLeadCreatedAt]);

  useEffect(() => {
    if (!isQuestionsRoute) return;
    markSeenNow(questionsStorageKey, latestQuestionCreatedAt ?? undefined);
  }, [isQuestionsRoute, questionsStorageKey, latestQuestionCreatedAt]);

  return (
    <AppContextProvider value={appContextValue}>
      <SWRConfig
        key={`${user.id}:${context.workspace.id}`}
        value={{
          fetcher: jsonFetcher,
          revalidateOnFocus: false,
          dedupingInterval: 30_000,
          errorRetryCount: 2,
        }}
      >
        <ToastProvider>
          <ModalProvider>
          {isFocusedAppRoute ? (
            <div className="min-h-screen bg-background">{children}</div>
          ) : (
            <div className="app-shell-gradient flex min-h-screen">
              <div className="hidden lg:flex lg:shrink-0 relative z-50">
                <Sidebar 
                  userEmail={user.email} 
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={toggleSidebarCollapse}
                  analyticsHasNewActivity={hasNewAnalyticsActivity}
                  analyticsActivitySummary={
                    latestAnalyticsConversation
                      ? {
                          agentName:
                            latestAnalyticsConversation.agentLabel ??
                            latestAnalyticsConversation.agentName,
                          widgetName: latestAnalyticsConversation.widgetName,
                          latestSnippet: latestAnalyticsConversation.latestSnippet,
                          lastActivityAt: latestAnalyticsConversation.lastActivityAt,
                        }
                      : null
                  }
                  newLeadCount={effectiveNewLeadCount}
                  openQuestionCount={effectiveOpenQuestionCount}
                  onClearAnalyticsActivity={clearAnalyticsAttention}
                  onClearLeads={clearLeadsBadge}
                  onClearQuestions={clearQuestionsBadge}
                />
              </div>

              <div
                aria-hidden={!isSidebarOpen}
                className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden ${
                  isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={closeMobileSidebar}
              />

              <div
                ref={mobileDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-navigation-title"
                aria-hidden={!isSidebarOpen}
                inert={!isSidebarOpen}
                tabIndex={-1}
                className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 lg:hidden ${
                  isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <h2 id="mobile-navigation-title" className="sr-only">
                  {t("nav.navigationLandmark")}
                </h2>
                <Sidebar
                  mobile
                  onNavigate={closeMobileSidebar}
                  userEmail={user.email}
                  analyticsHasNewActivity={hasNewAnalyticsActivity}
                  analyticsActivitySummary={
                    latestAnalyticsConversation
                      ? {
                          agentName:
                            latestAnalyticsConversation.agentLabel ??
                            latestAnalyticsConversation.agentName,
                          widgetName: latestAnalyticsConversation.widgetName,
                          latestSnippet: latestAnalyticsConversation.latestSnippet,
                          lastActivityAt: latestAnalyticsConversation.lastActivityAt,
                        }
                      : null
                  }
                  newLeadCount={effectiveNewLeadCount}
                  openQuestionCount={effectiveOpenQuestionCount}
                  onClearAnalyticsActivity={clearAnalyticsAttention}
                  onClearLeads={clearLeadsBadge}
                  onClearQuestions={clearQuestionsBadge}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Topbar onOpenSidebar={openMobileSidebar} />
                <main
                  className={`flex-1 w-full ${
                    isAnalyticsRoute ? "overflow-hidden" : "overflow-y-auto"
                  }`}
                >
                  {children}
                </main>
              </div>
            </div>
          )}
          </ModalProvider>
        </ToastProvider>
      </SWRConfig>
    </AppContextProvider>
  );
}
