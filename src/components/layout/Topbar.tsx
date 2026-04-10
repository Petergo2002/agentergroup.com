"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface TopbarProps {
  onOpenSidebar?: () => void;
}

export function Topbar({
  onOpenSidebar,
}: TopbarProps) {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 lg:hidden glass-panel">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          aria-label={t("common.open")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container text-on-surface-variant transition-all hover:border-primary/20 hover:bg-surface-container-high hover:text-on-surface active:scale-95"
          onClick={onOpenSidebar}
        >
          <AppIcon name="menu" className="h-[22px] w-[22px]" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg border border-outline-variant/20 bg-surface-container-high" />
          <span className="font-headline font-bold text-on-surface">Agentergroup</span>
        </div>
      </div>
    </header>
  );
}
