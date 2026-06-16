"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import useSWR, { SWRConfig } from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ModalProvider } from "@/components/ui/ModalProvider";
import { AppContextProvider } from "@/components/app/AppContext";
import { jsonFetcher } from "@/lib/json-fetcher";
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

export function AppShell({ children, context, user }: AppShellProps) {
  const analyticsStorageKey = `${ANALYTICS_ACTIVITY_SEEN_PREFIX}:${context.workspace.id}`;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("agenter_sidebar_collapsed") === "true",
  );
  const { data: latestActivityData } = useSWR<DashboardLatestActivityResponse>(
    "/api/dashboard/latest-activity",
    jsonFetcher,
    {
      refreshInterval: 60_000,
    },
  );
  const [lastSeenAnalyticsActivityAt, setLastSeenAnalyticsActivityAt] = useState<string | null>(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem(analyticsStorageKey)
        : null,
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
  const isFocusedAgentRoute =
    /^\/agents\/[^/]+\/(builder|preview)$/.test(pathname) ||
    /^\/widgets\/[^/]+\/preview$/.test(pathname) ||
    /^\/assistants\/[^/]+$/.test(pathname);
  const isAnalyticsRoute = pathname.startsWith("/analytics");
  const latestAnalyticsConversation = latestActivityData?.latestConversation ?? null;
  const newLeadCount = latestActivityData?.newLeadCount ?? 0;
  const latestAnalyticsActivityAt = latestAnalyticsConversation?.lastActivityAt ?? null;
  const hasNewAnalyticsActivity =
    !isAnalyticsRoute &&
    Boolean(
      latestAnalyticsActivityAt &&
        (!lastSeenAnalyticsActivityAt ||
          latestAnalyticsActivityAt > lastSeenAnalyticsActivityAt),
    );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLastSeenAnalyticsActivityAt(localStorage.getItem(analyticsStorageKey));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [analyticsStorageKey]);

  useEffect(() => {
    if (!isAnalyticsRoute) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const seenAt = latestAnalyticsActivityAt ?? new Date().toISOString();
      localStorage.setItem(analyticsStorageKey, seenAt);
      setLastSeenAnalyticsActivityAt(seenAt);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [analyticsStorageKey, isAnalyticsRoute, latestAnalyticsActivityAt]);

  return (
    <AppContextProvider value={{ ...context, user }}>
      <SWRConfig
        value={{
          fetcher: jsonFetcher,
          revalidateOnFocus: false,
          dedupingInterval: 30_000,
          errorRetryCount: 2,
        }}
      >
        <ToastProvider>
          <ModalProvider>
          {isFocusedAgentRoute ? (
            <div className="min-h-screen bg-background">{children}</div>
          ) : (
            <div className="app-shell-gradient flex min-h-screen">
              <div className="hidden lg:flex lg:shrink-0 transition-all duration-300 relative z-50">
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
                  newLeadCount={newLeadCount}
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
                tabIndex={-1}
                className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 lg:hidden ${
                  isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <h2 id="mobile-navigation-title" className="sr-only">
                  Navigation
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
                  newLeadCount={newLeadCount}
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
