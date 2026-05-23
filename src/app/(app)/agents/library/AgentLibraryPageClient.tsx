"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AgentLibraryDialog } from "@/components/agents/AgentLibraryDialog";

export default function AgentLibraryPageClient() {
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[960px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="inline-flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Agent Library
        </span>
      </div>
      <h1 className="mt-5 font-headline text-[2.4rem] font-bold leading-[1.05] tracking-tight text-on-surface">
        Open the verified template library.
      </h1>
      <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-on-surface-variant/70">
        The library now opens as a dialog from the Agents page. This direct URL keeps the same dialog available.
      </p>
      <button
        onClick={() => setIsLibraryOpen(true)}
        className="mt-8 rounded-full bg-on-surface px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90"
      >
        Open Library
      </button>

      <AgentLibraryDialog
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
      />
    </div>
  );
}
