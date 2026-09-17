"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
const StoryContext = createContext<{ slot: number; setSlot: (slot: number) => void }>({ slot: 0, setSlot: () => {} });
export function StoryProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState(0);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}
export function useStory() { return useContext(StoryContext); }
