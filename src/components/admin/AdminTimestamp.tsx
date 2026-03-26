import {
  formatAdminDateTime,
  formatAdminRelativeTime,
} from "@/lib/admin/format";

interface AdminTimestampProps {
  value: string | null;
  className?: string;
}

export function AdminTimestamp({ value, className }: AdminTimestampProps) {
  return (
    <time
      dateTime={value ?? undefined}
      title={formatAdminDateTime(value)}
      className={className}
    >
      {formatAdminRelativeTime(value)}
    </time>
  );
}
