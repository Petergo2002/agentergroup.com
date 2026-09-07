"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { PlatformLanguage } from "@/lib/i18n";

interface MarketingLanguageSwitcherProps {
  label: string;
  serverLanguage: PlatformLanguage;
  compact?: boolean;
}

export function MarketingLanguageSwitcher({
  label,
  serverLanguage,
  compact = false,
}: MarketingLanguageSwitcherProps) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (language !== serverLanguage) {
      startTransition(() => router.refresh());
    }
  }, [language, router, serverLanguage]);

  function selectLanguage(nextLanguage: PlatformLanguage) {
    if (nextLanguage === language) return;

    setLanguage(nextLanguage);
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-[var(--mkt-border)] bg-white p-1 ${
        compact ? "gap-0" : "gap-1"
      }`}
      aria-label={label}
      aria-busy={isPending}
    >
      {(["en", "sv"] as const).map((option) => {
        const selected = language === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => selectLanguage(option)}
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              selected
                ? "bg-[var(--mkt-ink)] text-white"
                : "text-[var(--mkt-muted)] hover:bg-[var(--mkt-soft)] hover:text-[var(--mkt-ink)]"
            }`}
            aria-pressed={selected}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
