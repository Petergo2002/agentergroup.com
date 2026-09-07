"use client";

import { useParams } from "next/navigation";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { MiloLoadingScreen } from "@/components/milo/MiloLoadingScreen";

export function AgentBuilderLoadingScreen() {
  const params = useParams<{ id: string }>();
  const { workspace } = useAppContext();
  const { t } = useLanguage();
  const isPrimaryMilo =
    process.env.NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED !== "false" &&
    workspace.product_experience === "milo" &&
    workspace.primary_customer_agent_id === params.id;

  if (isPrimaryMilo) {
    return <MiloLoadingScreen />;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      <aside className="w-80 border-r border-outline-variant/10 bg-surface-container-lowest p-4">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-background" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-on-surface-variant">{t("agentBuilder.loadingBuilder")}</p>
        </div>
      </main>
      <aside className="w-80 border-l border-outline-variant/10 bg-surface-container-lowest p-4">
        <div className="h-48 animate-pulse rounded-[1.75rem] bg-surface-container" />
      </aside>
    </div>
  );
}
