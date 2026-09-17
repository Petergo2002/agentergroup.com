"use client";

import { usePathname } from "next/navigation";
import { MiloLoadingScreen } from "@/components/milo/MiloLoadingScreen";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function Loading() {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (pathname === "/milo") {
    return <MiloLoadingScreen />;
  }

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-on-surface-variant">{t("common.loading")}</p>
      </div>
    </div>
  );
}
