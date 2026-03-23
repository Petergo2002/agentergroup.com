import type {
  BuilderDefinition,
  GoogleCalendarBuilderNodeData,
  GoogleCalendarSelection,
} from "@/lib/types";

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
  timezone: string | null;
}

export function buildDefaultGoogleCalendarSelection(): GoogleCalendarSelection {
  return {
    connectionId: null,
    calendarId: null,
    calendarLabel: null,
    timezone: null,
    includePrimaryCalendar: false,
  };
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCalendarRecord(record: Record<string, unknown>) {
  const id =
    pickString(record.id) ??
    pickString(record.calendarId) ??
    pickString(record.calendar_id);

  if (!id) {
    return null;
  }

  const summary =
    pickString(record.summary) ??
    pickString(record.summaryOverride) ??
    pickString(record.name) ??
    id;

  return {
    id,
    summary,
    primary: record.primary === true,
    accessRole:
      pickString(record.accessRole) ?? pickString(record.access_role) ?? null,
    timezone:
      pickString(record.timeZone) ??
      pickString(record.timezone) ??
      pickString(record.time_zone),
  } satisfies GoogleCalendarListItem;
}

export function extractGoogleCalendarSelectionFromNodes(
  nodes: unknown[] | null | undefined,
): GoogleCalendarSelection {
  if (!Array.isArray(nodes)) {
    return buildDefaultGoogleCalendarSelection();
  }

  const calendarNode = nodes.find((node) => {
    if (!node || typeof node !== "object") {
      return false;
    }

    const data = (node as { data?: { kind?: unknown } }).data;
    return data?.kind === "googlecalendar";
  }) as { data?: Partial<GoogleCalendarBuilderNodeData> } | undefined;

  if (!calendarNode?.data) {
    return buildDefaultGoogleCalendarSelection();
  }

  return {
    connectionId: pickString(calendarNode.data.connectionId),
    calendarId: pickString(calendarNode.data.calendarId),
    calendarLabel: pickString(calendarNode.data.calendarLabel),
    timezone: pickString(calendarNode.data.timezone),
    includePrimaryCalendar: calendarNode.data.includePrimaryCalendar === true,
  };
}

export function extractGoogleCalendarSelectionFromDefinition(
  definition: BuilderDefinition | null | undefined,
) {
  return extractGoogleCalendarSelectionFromNodes(definition?.nodes);
}

export function extractGoogleCalendarListItems(payload: unknown) {
  const candidate =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;

  const buckets = [
    candidate?.items,
    candidate?.calendars,
    candidate?.data,
    candidate?.data && typeof candidate.data === "object"
      ? (candidate.data as Record<string, unknown>).items
      : null,
    candidate?.data && typeof candidate.data === "object"
      ? (candidate.data as Record<string, unknown>).calendars
      : null,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    const calendars = bucket
      .map((item) =>
        item && typeof item === "object"
          ? normalizeCalendarRecord(item as Record<string, unknown>)
          : null,
      )
      .filter(Boolean) as GoogleCalendarListItem[];

    if (calendars.length > 0) {
      return calendars.sort((left, right) => {
        if (left.primary !== right.primary) {
          return left.primary ? -1 : 1;
        }

        return left.summary.localeCompare(right.summary);
      });
    }
  }

  return [] as GoogleCalendarListItem[];
}
