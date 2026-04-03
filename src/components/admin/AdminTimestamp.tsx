import {
  formatAdminDateTime,
  formatAdminRelativeTime,
} from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminTimestampProps {
  value: string | null;
  className?: string;
  language: PlatformLanguage;
}

export function AdminTimestamp({ value, className, language }: AdminTimestampProps) {
  return (
    <time
      dateTime={value ?? undefined}
      title={formatAdminDateTime(value, language)}
      className={className}
    >
      {formatAdminRelativeTime(value, language)}
    </time>
  );
}
