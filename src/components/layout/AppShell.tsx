"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ModalProvider } from "@/components/ui/ModalProvider";
import { AppContextProvider } from "@/components/app/AppContext";
import type { AppWorkspaceContext } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  context: AppWorkspaceContext;
  user: {
    id: string;
    email: string | null;
  };
}

export function AppShell({ children, context, user }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isFocusedAgentRoute =
    /^\/agents\/[^/]+\/(builder|preview)$/.test(pathname) ||
    /^\/widgets\/[^/]+\/preview$/.test(pathname) ||
    /^\/assistants\/[^/]+$/.test(pathname);
  const isAnalyticsRoute = pathname.startsWith("/analytics");

  return (
    <AppContextProvider value={{ ...context, user }}>
      <ToastProvider>
        <ModalProvider>
          {isFocusedAgentRoute ? (
            <div className="min-h-screen bg-background">{children}</div>
          ) : (
            <div className="app-shell-gradient flex min-h-screen">
              <div className="hidden lg:flex lg:shrink-0">
                <Sidebar userEmail={user.email} />
              </div>

              <div
                aria-hidden={!isSidebarOpen}
                className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden ${
                  isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setIsSidebarOpen(false)}
              />

              <div
                className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 lg:hidden ${
                  isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <Sidebar
                  mobile
                  onNavigate={() => setIsSidebarOpen(false)}
                  userEmail={user.email}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} />
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
    </AppContextProvider>
  );
}
