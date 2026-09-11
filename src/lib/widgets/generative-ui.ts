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

/**
 * Google's freeBusy reports every minute nobody has a meeting, so a normal
 * calendar is "free" all night. Offering a visitor 03:00 is never right, and
 * because the first free window of the day starts at local midnight it used to
 * consume the whole slot budget before reaching working hours.
 */
const DEFAULT_BOOKING_HOUR_START = 8;
const DEFAULT_BOOKING_HOUR_END = 18;
const MAX_SLOTS = 8;

/** Hour-of-day (0-23) and minutes for an instant, in the given IANA timezone. */
function getLocalTimeParts(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const lookup = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    return { hour: Number(lookup.hour), minute: Number(lookup.minute) };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}

function isWithinBookingHours(
  slotStart: Date,
  slotEnd: Date,
  timezone: string,
  hourStart: number,
  hourEnd: number,
) {
  const start = getLocalTimeParts(slotStart, timezone);
  const end = getLocalTimeParts(slotEnd, timezone);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  // A slot ending exactly at midnight reports 00:00, which would otherwise look
  // like it falls before the window rather than closing the day.
  const normalizedEnd = endMinutes === 0 ? 24 * 60 : endMinutes;

  return (
    startMinutes >= hourStart * 60 &&
    normalizedEnd <= hourEnd * 60 &&
    normalizedEnd > startMinutes
  );
}

function findSlots(
  messages: ToolMessageLike[],
  durationMinutes: number,
  timezone: string,
  nowMs: number,
  hourStart: number,
  hourEnd: number,
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
        // Never offer a time that has already passed.
        if (slotStartMs <= nowMs) continue;

        const slotStartDate = new Date(slotStartMs);
        const slotEndDate = new Date(slotStartMs + durationMs);

        if (
          !isWithinBookingHours(
            slotStartDate,
            slotEndDate,
            timezone,
            hourStart,
            hourEnd,
          )
        ) {
          continue;
        }

        const slotStart = slotStartDate.toISOString();
        const slotEnd = slotEndDate.toISOString();
        slots.set(`${slotStart}:${slotEnd}`, { start: slotStart, end: slotEnd });
      }
    }
  }

  const eligible = Array.from(slots.values()).sort((left, right) =>
    left.start.localeCompare(right.start),
  );

  if (eligible.length <= MAX_SLOTS) {
    return eligible;
  }

  // Taking the first N consecutive slots buries the whole day under one hour of
  // the morning, so an afternoon request sees nothing it asked for. Sample
  // evenly across the day instead, always keeping the earliest option.
  const spread: WidgetCalendarSlot[] = [];
  const step = (eligible.length - 1) / (MAX_SLOTS - 1);

  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const slot = eligible[Math.round(index * step)];
    if (slot && !spread.some((existing) => existing.start === slot.start)) {
      spread.push(slot);
    }
  }

  return spread;
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
  /** Overridable so tests are deterministic and hours can become configurable. */
  nowMs?: number;
  bookingHourStart?: number;
  bookingHourEnd?: number;
}): WidgetGenerativeUi | null {
  const timezone = input.timezone?.trim() || "UTC";
  const durationMinutes =
    typeof input.durationMinutes === "number" &&
    Number.isFinite(input.durationMinutes) &&
    input.durationMinutes > 0
      ? Math.round(input.durationMinutes)
      : 30;
  const nowMs = typeof input.nowMs === "number" ? input.nowMs : Date.now();
  const hourStart =
    typeof input.bookingHourStart === "number"
      ? input.bookingHourStart
      : DEFAULT_BOOKING_HOUR_START;
  const hourEnd =
    typeof input.bookingHourEnd === "number"
      ? input.bookingHourEnd
      : DEFAULT_BOOKING_HOUR_END;

  const confirmation = findBookingConfirmation(input.toolMessages, timezone);
  if (confirmation) return confirmation;

  const slots = findSlots(
    input.toolMessages,
    durationMinutes,
    timezone,
    nowMs,
    hourStart,
    hourEnd,
  );
  return slots.length > 0
    ? {
        type: "calendar_availability",
        timezone,
        durationMinutes,
        slots,
      }
    : null;
}
