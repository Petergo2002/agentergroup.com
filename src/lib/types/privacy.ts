import type { WidgetSessionRecord, WidgetSessionMessageRecord } from "./widget";

export type PrivacySubjectLookupMode = "email" | "sessionId";

export interface PrivacySubjectLookupQuery {
  mode: PrivacySubjectLookupMode;
  email?: string;
  sessionId?: string;
}

export interface PrivacyLeadMatch {
  id: string;
  widgetId: string;
  widgetName: string | null;
  widgetSessionId: string | null;
  sessionId: string | null;
  widgetAgentId: string | null;
  agentId: string | null;
  agentName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
}

export interface PrivacySessionMatch {
  widgetSessionId: string;
  sessionId: string;
  widgetId: string;
  widgetName: string | null;
  widgetAgentId: string | null;
  agentId: string | null;
  agentName: string | null;
  source: WidgetSessionRecord["source"];
  startedAt: string;
  lastActivityAt: string;
  pageUrl: string | null;
  referrer: string | null;
  messageCount: number;
  matchSource: "session_id" | "lead_link";
}

export interface PrivacyTranscriptMatch {
  widgetSessionId: string;
  sessionId: string;
  widgetId: string;
  widgetName: string | null;
  widgetAgentId: string | null;
  agentId: string | null;
  agentName: string | null;
  source: WidgetSessionRecord["source"];
  startedAt: string;
  lastActivityAt: string;
  pageUrl: string | null;
  referrer: string | null;
  messageCount: number;
  matchedSnippet: string | null;
}

export interface PrivacySubjectLookupSummary {
  leadCount: number;
  sessionCount: number;
  messageCount: number;
  transcriptMatchSessionCount: number;
}

export interface PrivacySubjectLookupResponse {
  query: PrivacySubjectLookupQuery;
  summary: PrivacySubjectLookupSummary;
  leadMatches: PrivacyLeadMatch[];
  sessionMatches: PrivacySessionMatch[];
  transcriptMatches: PrivacyTranscriptMatch[];
}

export interface PrivacyExportMessage {
  id: string;
  widgetSessionId: string;
  role: WidgetSessionMessageRecord["role"];
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PrivacySubjectExportPayload {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  query: PrivacySubjectLookupQuery;
  exportedAt: string;
  summary: PrivacySubjectLookupSummary;
  leadMatches: PrivacyLeadMatch[];
  sessionMatches: PrivacySessionMatch[];
  transcriptMatches: PrivacyTranscriptMatch[];
  messages: PrivacyExportMessage[];
}

export interface PrivacyDeleteSummary {
  leadCount: number;
  sessionCount: number;
  messageCount: number;
}

export interface PrivacyDeleteResponse {
  ok: true;
  deleted: PrivacyDeleteSummary;
}

export interface PrivacyRetentionRunSummary {
  cutoffIso: string;
  dryRun: boolean;
  deleted: {
    leadCount: number;
    sessionCount: number;
    messageCount: number;
    rateLimitWindowCount?: number;
  };
}
