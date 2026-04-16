export type ConversationEndReason =
  | "assistant_suggestion"
  | "inactivity_timeout";

export interface EndChatPolicy {
  enabled: boolean;
  inactivityTimeoutSeconds: number | null;
  allowAssistantSuggestion: boolean;
}

export type GmailRecipientMode = "ai_decides" | "specific_email";

export interface GmailRecipientPolicy {
  mode: GmailRecipientMode;
  specificEmail: string | null;
}

export interface GoogleCalendarSelection {
  connectionId: string | null;
  calendarId: string | null;
  calendarLabel: string | null;
  timezone: string | null;
  includePrimaryCalendar: boolean;
}

export interface CalSelection {
  connectionId: string | null;
  eventTypeMode: "ai_decides" | "specific_event_type";
  eventTypeId: string | null;
  eventTypeLabel: string | null;
  timezone: string | null;
}

export interface EndChatMetadata {
  suggested: boolean;
  sessionCompleted: boolean;
  reason: ConversationEndReason | null;
  source: "assistant" | "system";
  summary?: string | null;
}