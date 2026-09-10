interface ToolMessageLike {
  content?: unknown;
  name?: unknown;
}

export interface WidgetCalendarSlot {
  start: string;
  end: string;
}

export type WidgetGenerativeUi =
  | {
      type: "calendar_availability";
      timezone: string;
      durationMinutes: number;
      slots: WidgetCalendarSlot[];
    }
  | {
      type: "calendar_booking_confirmation";
      timezone: string;
      title: string | null;
      start: string;
      end: string | null;
      calendarUrl: string | null;
      meetingUrl: string | null;
    };

type UnknownRecord = Record<string, unknown>;

const AVAILABILITY_TOOLS = new Set([
  "GOOGLECALENDAR_FIND_FREE_SLOTS",
  "CAL_GET_AVAILABLE_SLOTS_INFO",
]);
const BOOKING_TOOLS = new Set([
  "GOOGLECALENDAR_CREATE_EVENT",
  "GOOGLECALENDAR_QUICK_ADD",
  "CAL_CREATE_BOOKING_VERSION_2",
]);
const START_KEYS = [
  "start",
  "start_time",
  "startTime",
  "start_datetime",
  "startDateTime",
  "slot_start",
];
const END_KEYS = [
  "end",
  "end_time",
  "endTime",
  "end_datetime",
  "endDateTime",
  "slot_end",
];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseContent(content: unknown): unknown {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readNestedString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return null;
  return readNestedString(value.dateTime) ?? readNestedString(value.datetime);
}

function readFirstString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = readNestedString(record[key]);
    if (value) return value;
  }
  return null;
}

function toIso(value: string | null): string | null {
  if (!value || !/\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function collectRecords(value: unknown, depth = 0): UnknownRecord[] {
  if (depth > 7) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRecords(item, depth + 1));
  }
  if (!isRecord(value)) return [];
  return [
    value,
    ...Object.values(value).flatMap((item) => collectRecords(item, depth + 1)),
  ];
}

function readResultRecords(message: ToolMessageLike) {
  const parsed = parseContent(message.content);
  if (isRecord(parsed) && parsed.successful === false) return [];
  return collectRecords(parsed);
}

function isAvailabilityContainerKey(key: string) {
  const normalized = key.replace(/[^a-z]/gi, "").toLowerCase();
  return (
    normalized === "free" ||
    normalized === "availability" ||
    normalized === "slots" ||
    normalized === "freeslots" ||
    normalized === "availableslots" ||
    normalized === "timeslots"
  );
}

function collectAvailabilityCandidates(
  value: unknown,
  parentKey = "",
  insideAvailability = false,
  depth = 0,
): Array<UnknownRecord | string> {
  if (depth > 7) return [];
  if (Array.isArray(value)) {
    const isDirectAvailabilityArray =
      insideAvailability ||
      isAvailabilityContainerKey(parentKey) ||
      ["data", "response_data", "responseData"].includes(parentKey);
    return value.flatMap((item) => {
      if (isDirectAvailabilityArray && (typeof item === "string" || isRecord(item))) {
        return [item];
      }
      return collectAvailabilityCandidates(
        item,
        parentKey,
        isDirectAvailabilityArray,
        depth + 1,
      );
    });
  }
  if (!isRecord(value)) return [];
  const candidates: Array<UnknownRecord | string> = [];
  if (insideAvailability && toIso(readFirstString(value, START_KEYS))) {
    candidates.push(value);
  }
  for (const [key, item] of Object.entries(value)) {
    if (key.replace(/[^a-z]/gi, "").toLowerCase() === "busy") continue;
    candidates.push(
      ...collectAvailabilityCandidates(
        item,
        key,
        insideAvailability || isAvailabilityContainerKey(key),
        depth + 1,
      ),
    );
  }
  return candidates;
}

function findSlots(
  messages: ToolMessageLike[],
  durationMinutes: number,
): WidgetCalendarSlot[] {
  const slots = new Map<string, WidgetCalendarSlot>();

  for (const message of messages) {
    if (!AVAILABILITY_TOOLS.has(String(message.name ?? "").toUpperCase())) continue;

    const parsedContent = parseContent(message.content);
    if (isRecord(parsedContent) && parsedContent.successful === false) continue;

    for (const candidate of collectAvailabilityCandidates(parsedContent)) {
      const start = toIso(
        typeof candidate === "string"
          ? candidate
          : readFirstString(candidate, START_KEYS),
      );
      if (!start) continue;
      const explicitEnd =
        typeof candidate === "string"
          ? null
          : toIso(readFirstString(candidate, END_KEYS));
      const end =
        explicitEnd ??
        new Date(new Date(start).getTime() + durationMinutes * 60_000).toISOString();
      if (new Date(end).getTime() <= new Date(start).getTime()) continue;
      const durationMs = durationMinutes * 60_000;
      for (
        let slotStartMs = new Date(start).getTime();
        slotStartMs + durationMs <= new Date(end).getTime();
        slotStartMs += durationMs
      ) {
        const slotStart = new Date(slotStartMs).toISOString();
        const slotEnd = new Date(slotStartMs + durationMs).toISOString();
        slots.set(`${slotStart}:${slotEnd}`, { start: slotStart, end: slotEnd });
      }
    }
  }

  return Array.from(slots.values())
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, 8);
}

function findBookingConfirmation(
  messages: ToolMessageLike[],
  timezone: string,
): WidgetGenerativeUi | null {
  for (const message of [...messages].reverse()) {
    if (!BOOKING_TOOLS.has(String(message.name ?? "").toUpperCase())) continue;

    const records = readResultRecords(message);
    const event = records.find((record) =>
      Boolean(toIso(readFirstString(record, START_KEYS))),
    );
    if (!event) continue;

    const start = toIso(readFirstString(event, START_KEYS));
    if (!start) continue;

    return {
      type: "calendar_booking_confirmation",
      timezone,
      title: readFirstString(event, ["summary", "title", "name", "event_title"]),
      start,
      end: toIso(readFirstString(event, END_KEYS)),
      calendarUrl:
        safeHttpsUrl(event.htmlLink) ??
        safeHttpsUrl(event.html_link) ??
        safeHttpsUrl(event.bookingUrl) ??
        safeHttpsUrl(event.booking_url),
      meetingUrl:
        safeHttpsUrl(event.hangoutLink) ??
        safeHttpsUrl(event.meetingUrl) ??
        safeHttpsUrl(event.meeting_url),
    };
  }

  return null;
}

export function buildWidgetGenerativeUi(input: {
  toolMessages: ToolMessageLike[];
  timezone?: string | null;
  durationMinutes?: number | null;
}): WidgetGenerativeUi | null {
  const timezone = input.timezone?.trim() || "UTC";
  const durationMinutes =
    typeof input.durationMinutes === "number" &&
    Number.isFinite(input.durationMinutes) &&
    input.durationMinutes > 0
      ? Math.round(input.durationMinutes)
      : 30;

  const confirmation = findBookingConfirmation(input.toolMessages, timezone);
  if (confirmation) return confirmation;

  const slots = findSlots(input.toolMessages, durationMinutes);
  return slots.length > 0
    ? {
        type: "calendar_availability",
        timezone,
        durationMinutes,
        slots,
      }
    : null;
}
