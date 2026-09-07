"use client";

import { MiloLogo } from "@/components/brand/MiloLogo";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface MiloLoadingScreenProps {
  className?: string;
}

export function MiloLoadingScreen({ className = "" }: MiloLoadingScreenProps) {
  const { t } = useLanguage();

  return (
    <main
      className={`flex min-h-screen w-full items-center justify-center bg-background ${className}`}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{t("agentBuilder.preparingMilo")}</span>
      <div className="relative flex h-[92px] w-[92px] items-center justify-center" aria-hidden="true">
        <MiloLogo size={72} className="h-[72px] w-[72px]" priority animated />
      </div>
    </main>
  );
}
