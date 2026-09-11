import type {
  ConversationEndReason,
  WidgetRecord,
  WidgetSessionMessageRecord,
  WidgetSessionRecord,
} from "@/lib/types";
import type {
  WidgetAdminSupabase,
  WidgetOrderedSelectBuilder,
  WidgetQueryResult,
} from "./server-types";

export async function upsertWidgetSession(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    sessionId: string;
    source: WidgetSessionRecord["source"];
    pageUrl?: string | null;
    referrer?: string | null;
    origin?: string | null;
    activeWidgetAgentId?: string | null;
    activeAgentId?: string | null;
    status?: WidgetSessionRecord["status"];
    endedAt?: string | null;
    endReason?: ConversationEndReason | null;
    lastUserMessageAt?: string | null;
    lastAssistantMessageAt?: string | null;
    visitorTokenHash?: string | null;
    conversationTitle?: string | null;
    lastMessagePreview?: string | null;
  },
) {
  const timestamp = new Date().toISOString();
  const payload: Record<string, string | null> = {
    widget_id: input.widgetId,
    session_id: input.sessionId,
    source: input.source,
    page_url: input.pageUrl ?? null,
    referrer: input.referrer ?? null,
    origin: input.origin ?? null,
    last_seen_at: timestamp,
  };

  if (input.activeWidgetAgentId !== undefined) {
    payload.active_widget_agent_id = input.activeWidgetAgentId;
  }

  if (input.activeAgentId !== undefined) {
    payload.active_agent_id = input.activeAgentId;
  }

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.endedAt !== undefined) {
    payload.ended_at = input.endedAt;
  }

  if (input.endReason !== undefined) {
    payload.end_reason = input.endReason;
  }

  if (input.lastUserMessageAt !== undefined) {
    payload.last_user_message_at = input.lastUserMessageAt;
  }

  if (input.lastAssistantMessageAt !== undefined) {
    payload.last_assistant_message_at = input.lastAssistantMessageAt;
  }

  if (input.visitorTokenHash !== undefined) {
    payload.visitor_token_hash = input.visitorTokenHash;
  }

  if (input.conversationTitle !== undefined) {
    payload.conversation_title = input.conversationTitle;
  }

  if (input.lastMessagePreview !== undefined) {
    payload.last_message_preview = input.lastMessagePreview;
  }

  const { data, error } = await supabase
    .from("widget_sessions")
    .upsert(payload, { onConflict: "widget_id,session_id" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert widget session.");
  }

  return data as WidgetSessionRecord;
}

export async function completeWidgetSession(
  supabase: WidgetAdminSupabase,
  input: {
    session: WidgetSessionRecord;
    reason: ConversationEndReason;
    completedAt?: string;
    lastAssistantMessageAt?: string | null;
  },
) {
  if (input.session.status === "completed") {
    return input.session;
  }

  const completedAt = input.completedAt ?? new Date().toISOString();

  return upsertWidgetSession(supabase, {
    widgetId: input.session.widget_id,
    sessionId: input.session.session_id,
    source: input.session.source,
    pageUrl: input.session.page_url,
    referrer: input.session.referrer,
    origin: input.session.origin,
    activeWidgetAgentId: input.session.active_widget_agent_id,
    activeAgentId: input.session.active_agent_id,
    status: "completed",
    endedAt: completedAt,
    endReason: input.reason,
    lastAssistantMessageAt:
      input.lastAssistantMessageAt ?? input.session.last_assistant_message_at,
    visitorTokenHash: input.session.visitor_token_hash,
    conversationTitle: input.session.conversation_title,
    lastMessagePreview: input.session.last_message_preview,
  });
}

export async function handleConversationCompleted(input: {
  widget: WidgetRecord;
  session: WidgetSessionRecord;
  reason: ConversationEndReason;
}) {
  void input;
  // Future after-chat actions will attach here.
}

export async function loadWidgetSession(
  supabase: WidgetAdminSupabase,
  widgetId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("widget_sessions")
    .select("*")
    .eq("widget_id", widgetId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as WidgetSessionRecord | null;
}


export async function loadOrderedWidgetSessionHistory(
  supabase: WidgetAdminSupabase,
  widgetSessionId: string,
) {
  const orderedBuilder = supabase
    .from("widget_session_messages")
    .select<WidgetSessionMessageRecord>("*") as unknown as WidgetOrderedSelectBuilder<WidgetSessionMessageRecord>;
  const result = await orderedBuilder
    .eq("widget_session_id", widgetSessionId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = (result.data ?? []) as unknown as WidgetSessionMessageRecord[];
  rows.reverse();
  return rows;
}

export async function insertWidgetMessages(
  supabase: WidgetAdminSupabase,
  input: {
    widgetSessionId: string;
    widgetId: string;
    widgetAgentId: string | null;
    agentId: string | null;
    messages: Array<{
      role: WidgetSessionMessageRecord["role"];
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  if (input.messages.length === 0) {
    return [];
  }

  const payload = input.messages.map((message) => ({
    widget_session_id: input.widgetSessionId,
    widget_id: input.widgetId,
    widget_agent_id: input.widgetAgentId,
    agent_id: input.agentId,
    role: message.role,
    content: message.content,
    metadata: message.metadata ?? {},
  }));
  const insertBuilder = supabase.from("widget_session_messages").insert(payload) as unknown as {
    select: (columns?: string) => Promise<WidgetQueryResult<WidgetSessionMessageRecord[]>>;
  };
  const { data, error } = await insertBuilder.select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WidgetSessionMessageRecord[];
}
