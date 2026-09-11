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
    meetingDurationMinutes: 30,
  };
}

/**
 * GOOGLECALENDAR_CREATE_EVENT takes its length as event_duration_hour plus
 * event_duration_minutes, and the model picks both on its own — so it happily
 * books an hour right after telling the visitor the meeting is 30 minutes, and
 * the booking then disagrees with the availability slots the widget rendered at
 * the configured length. Returns the arguments that pin the configured length,
 * or null when no duration is configured. event_duration_minutes only accepts
 * 0-59, so whole hours have to move into event_duration_hour.
 */
export function buildMeetingDurationArguments(
  meetingDurationMinutes: number | null | undefined,
) {
  if (
    typeof meetingDurationMinutes !== "number" ||
    !Number.isFinite(meetingDurationMinutes) ||
    meetingDurationMinutes <= 0
  ) {
    return null;
  }

  const totalMinutes = Math.round(meetingDurationMinutes);

  return {
    event_duration_hour: Math.floor(totalMinutes / 60),
    event_duration_minutes: totalMinutes % 60,
  };
}

/**
 * True when the value is a timezone the Intl engine can actually resolve.
 * Used to decide whether a model-supplied `timezone` argument can be trusted
 * as the zone its naive datetime was written in.
 */
export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
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

  const duration =
    typeof calendarNode.data.meetingDurationMinutes === "number" &&
    calendarNode.data.meetingDurationMinutes > 0
      ? calendarNode.data.meetingDurationMinutes
      : 30;

  return {
    connectionId: pickString(calendarNode.data.connectionId),
    calendarId: pickString(calendarNode.data.calendarId),
    calendarLabel: pickString(calendarNode.data.calendarLabel),
    timezone: pickString(calendarNode.data.timezone),
    includePrimaryCalendar: calendarNode.data.includePrimaryCalendar === true,
    meetingDurationMinutes: duration,
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
