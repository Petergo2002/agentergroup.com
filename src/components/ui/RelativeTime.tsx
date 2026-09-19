"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useTickingClock } from "@/lib/hooks/useTickingClock";
import { formatLocaleDateTime } from "@/lib/i18n";
import { formatRelativeDate } from "@/lib/utils";

interface RelativeTimeProps {
  value?: string | null;
  className?: string;
  /** Skip the exact date on hover, where the surrounding element owns it. */
  hideExactOnHover?: boolean;
}

/**
 * A relative timestamp that keeps itself current.
 *
 * `formatRelativeDate` reads the clock at render time, so a plain call renders
 * "Just now" and then leaves it there until something unrelated repaints the
 * component. On a list nobody is interacting with, that can read "Just now"
 * an hour later, which makes the app look stuck.
 *
 * Rendered as a real `<time>` so the machine-readable instant is in the markup
 * even though the visible text is fuzzy, with the exact date on hover.
 */
export function RelativeTime({
  value,
  className,
  hideExactOnHover = false,
}: RelativeTimeProps) {
  useTickingClock();
  const { language } = useLanguage();

  return (
    <time
      dateTime={value ?? undefined}
      title={
        hideExactOnHover || !value
          ? undefined
          : formatLocaleDateTime(value, language)
      }
      className={className}
    >
      {formatRelativeDate(value, language)}
    </time>
  );
}
