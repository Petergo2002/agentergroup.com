import type { WidgetSessionRecord } from "@/lib/types";
import {
  WIDGET_ACTIVE_TURN_STALE_MS,
  type WidgetAdminSupabase,
  type WidgetSessionTurnLockRow,
} from "./server-types";

function getTurnLockStaleThreshold(referenceTime = Date.now()) {
  return new Date(referenceTime - WIDGET_ACTIVE_TURN_STALE_MS).toISOString();
}

export function isWidgetSessionTurnLocked(
  session: Pick<
    WidgetSessionRecord,
    "active_turn_request_id" | "active_turn_started_at"
  > | null,
  referenceTime = Date.now(),
) {
  if (!session?.active_turn_request_id || !session.active_turn_started_at) {
    return false;
  }

  const startedAt = Date.parse(session.active_turn_started_at);

  if (Number.isNaN(startedAt)) {
    return false;
  }

  return startedAt >= referenceTime - WIDGET_ACTIVE_TURN_STALE_MS;
}

export async function acquireWidgetSessionTurnLock(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    requestId: string;
    startedAt?: string;
  },
) {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const { data, error } = await supabase.rpc<WidgetSessionTurnLockRow[]>(
    "acquire_widget_session_turn_lock",
    {
      p_widget_id: input.widgetId,
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
      p_started_at: startedAt,
      p_stale_before: getTurnLockStaleThreshold(Date.parse(startedAt)),
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;

  return {
    acquired: Boolean(row?.acquired),
    sessionStatus: row?.status ?? null,
    activeTurnRequestId: row?.active_turn_request_id ?? null,
    activeTurnStartedAt: row?.active_turn_started_at ?? null,
    startedAt,
  };
}

export async function releaseWidgetSessionTurnLock(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    requestId: string;
  },
) {
  const { data, error } = await supabase.rpc<boolean>(
    "release_widget_session_turn_lock",
    {
      p_widget_id: input.widgetId,
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
