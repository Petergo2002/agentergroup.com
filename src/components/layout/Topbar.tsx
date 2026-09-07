"use client";

import Link from "next/link";
import { AppIcon } from "@/components/icons/AppIcon";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { BrandLogo } from "@/components/BrandLogo";

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
          className="depth-button flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container text-on-surface-variant transition-all hover:border-primary/20 hover:bg-surface-container-high hover:text-on-surface active:scale-95"
          onClick={onOpenSidebar}
        >
          <AppIcon name="menu" className="h-[22px] w-[22px]" />
        </button>
        <Link
          href="/"
          title="Agentergroup Home"
          aria-label="Back to landing page"
          className="group inline-flex items-center rounded-xl p-1 transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <BrandLogo className="h-6 w-auto text-on-surface transition-transform duration-200 group-hover:scale-105" />
        </Link>
      </div>
    </header>
  );
}
