"use client";

import dynamic from "next/dynamic";

const AgentBuilderClient = dynamic(() => import("./AgentBuilderClient"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-background px-6 py-8 text-on-surface">
      <div className="mx-auto flex w-full max-w-[1600px] animate-pulse flex-col gap-6">
        <div className="h-12 w-full rounded-2xl bg-surface-container" />
        <div className="grid min-h-[720px] gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <div className="rounded-3xl bg-surface-container-low" />
          <div className="rounded-3xl bg-surface-container-low" />
          <div className="rounded-3xl bg-surface-container-low" />
        </div>
      </div>
    </main>
  ),
});

export default function AgentBuilderPage() {
  return <AgentBuilderClient />;
}
