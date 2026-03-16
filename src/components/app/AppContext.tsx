"use client";

import { createContext, useContext } from "react";
import type { AppWorkspaceContext } from "@/lib/types";

interface AppContextValue extends AppWorkspaceContext {
  user: {
    id: string;
    email: string | null;
  };
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppContextValue;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used inside AppContextProvider");
  }

  return context;
}
