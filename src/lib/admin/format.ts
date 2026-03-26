const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatRelativeUnit(value: number, unit: Intl.RelativeTimeFormatUnit) {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(value, unit);
}

export function formatAdminNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatAdminDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatAdminDateTime(value: string | null) {
  if (!value) return "Never";
  return dateTimeFormatter.format(new Date(value));
}

export function formatAdminRelativeTime(value: string | null) {
  if (!value) return "Never";

  const diffMs = new Date(value).getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) return "just now";
  if (absSeconds < 60 * 60) {
    return formatRelativeUnit(Math.round(diffSeconds / 60), "minute");
  }
  if (absSeconds < 60 * 60 * 24) {
    return formatRelativeUnit(Math.round(diffSeconds / (60 * 60)), "hour");
  }
  if (absSeconds < 60 * 60 * 24 * 30) {
    return formatRelativeUnit(Math.round(diffSeconds / (60 * 60 * 24)), "day");
  }
  if (absSeconds < 60 * 60 * 24 * 365) {
    return formatRelativeUnit(
      Math.round(diffSeconds / (60 * 60 * 24 * 30)),
      "month",
    );
  }

  return formatRelativeUnit(
    Math.round(diffSeconds / (60 * 60 * 24 * 365)),
    "year",
  );
}

export function getAdminActivityState(value: string | null) {
  if (!value) return "inactive" as const;
  const diffMs = Date.now() - new Date(value).getTime();
  return diffMs <= 7 * 24 * 60 * 60 * 1000 ? ("active" as const) : ("inactive" as const);
}
