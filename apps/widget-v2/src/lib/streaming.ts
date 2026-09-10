import type { WidgetGenerativeUi } from "../types";

interface ResolveStreamedAgentContentInput {
  previousContent: string;
  incomingContent: string;
  streaming: boolean;
}

type WidgetStreamMessage = {
  role: "user" | "agent";
  content: string;
  isStreaming?: boolean;
};

interface ShouldRevealInterimStreamContentInput {
  nowMs: number;
  streamStartedAtMs: number;
  minDelayMs: number;
  streamDone: boolean;
  hasRevealedInterimContent: boolean;
}

export const MAX_STATUS_LENGTH = 120;

export type WidgetStreamEvent =
  | { type: "done" }
  | { type: "delta"; content: string }
  | { type: "content"; content: string }
  | { type: "ui"; ui: WidgetGenerativeUi }
  | { type: "status"; status: string }
  | {
      type: "session-completed";
      endReason: "assistant_suggestion" | "inactivity_timeout" | null;
    }
  | { type: "error"; message: string; code?: string }
  | { type: "noop" };

function parseGenerativeUi(value: unknown): WidgetGenerativeUi | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ui = value as Record<string, unknown>;

  if (ui.type === "calendar_availability") {
    if (
      typeof ui.timezone !== "string" ||
      typeof ui.durationMinutes !== "number" ||
      !Array.isArray(ui.slots)
    ) {
      return null;
    }
    const slots = ui.slots.filter(
      (slot): slot is { start: string; end: string } =>
        Boolean(
          slot &&
            typeof slot === "object" &&
            typeof (slot as { start?: unknown }).start === "string" &&
            typeof (slot as { end?: unknown }).end === "string",
        ),
    );
    if (slots.length === 0) return null;
    return {
      type: "calendar_availability",
      timezone: ui.timezone,
      durationMinutes: ui.durationMinutes,
      slots,
    };
  }

  if (
    ui.type === "calendar_booking_confirmation" &&
    typeof ui.timezone === "string" &&
    typeof ui.start === "string"
  ) {
    return {
      type: "calendar_booking_confirmation",
      timezone: ui.timezone,
      title: typeof ui.title === "string" ? ui.title : null,
      start: ui.start,
      end: typeof ui.end === "string" ? ui.end : null,
      calendarUrl: typeof ui.calendarUrl === "string" ? ui.calendarUrl : null,
      meetingUrl: typeof ui.meetingUrl === "string" ? ui.meetingUrl : null,
    };
  }

  return null;
}

export function parseWidgetStreamEvent(data: string): WidgetStreamEvent {
  if (data === "[DONE]") {
    return { type: "done" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error("The reply stream contained invalid data.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("The reply stream contained invalid data.");
  }

  const payload = parsed as Record<string, unknown>;
  if (typeof payload.error === "string") {
    return {
      type: "error",
      message: payload.error,
      ...(typeof payload.code === "string" ? { code: payload.code } : {}),
    };
  }

  if (payload.sessionCompleted === true) {
    return {
      type: "session-completed",
      endReason:
        payload.endReason === "assistant_suggestion" ||
        payload.endReason === "inactivity_timeout"
          ? payload.endReason
          : null,
    };
  }

  if (typeof payload.delta === "string") {
    return { type: "delta", content: payload.delta };
  }

  if (typeof payload.content === "string") {
    return { type: "content", content: payload.content };
  }

  const ui = parseGenerativeUi(payload.ui);
  if (ui) return { type: "ui", ui };

  if (typeof payload.status === "string" && payload.status.trim()) {
    return {
      type: "status",
      status: payload.status.trim().slice(0, MAX_STATUS_LENGTH),
    };
  }

  return { type: "noop" };
}

export function getWidgetStreamCompletionError(input: {
  receivedDoneEvent: boolean;
  content: string;
}): string | null {
  if (!input.receivedDoneEvent) {
    return "The connection ended before the reply finished. Please try again.";
  }

  if (!input.content.trim()) {
    return "The assistant returned an empty reply. Please try again.";
  }

  return null;
}

export function resolveStreamedAgentContent({
  previousContent,
  incomingContent,
  streaming,
}: ResolveStreamedAgentContentInput): string {
  if (!previousContent) return incomingContent;
  if (incomingContent.length >= previousContent.length) return incomingContent;
  if (!streaming) return incomingContent;
  return previousContent;
}

export function shouldRevealInterimStreamContent({
  nowMs,
  streamStartedAtMs,
  minDelayMs,
  streamDone,
  hasRevealedInterimContent,
}: ShouldRevealInterimStreamContentInput): boolean {
  if (streamDone) return true;
  if (hasRevealedInterimContent) return true;
  return nowMs - streamStartedAtMs >= minDelayMs;
}

export function applyStreamFailureToMessages(
  messages: WidgetStreamMessage[],
  fallbackContent: string,
): WidgetStreamMessage[] {
  if (messages.length === 0) {
    return [{ role: "agent", content: fallbackContent, isStreaming: false }];
  }

  const next = [...messages];
  const last = next[next.length - 1];
  if (last?.role === "agent" && last.isStreaming) {
    next[next.length - 1] = {
      ...last,
      content: fallbackContent,
      isStreaming: false,
    };
    return next;
  }

  return [
    ...next,
    { role: "agent", content: fallbackContent, isStreaming: false },
  ];
}
