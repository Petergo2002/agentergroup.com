import type { BuilderNodeKind, BuilderNodeStatus, BuilderNodeBadgeTone } from "./enums";
import type { GmailRecipientMode } from "./policy";

export interface BaseBuilderNodeData extends Record<string, unknown> {
  kind: BuilderNodeKind;
  label: string;
  type?: string;
  icon?: string;
  description?: string;
  status?: BuilderNodeStatus;
  badgeText?: string;
  badgeTone?: BuilderNodeBadgeTone;
  locked?: boolean;
}

export interface TriggerBuilderNodeData extends BaseBuilderNodeData {
  kind: "trigger";
  locked: true;
}

export interface AgentBuilderNodeData extends BaseBuilderNodeData {
  kind: "agent";
  showConfidence?: boolean;
  confidenceValue?: number;
  locked: true;
}

export interface KnowledgeBuilderNodeData extends BaseBuilderNodeData {
  kind: "knowledge";
  sourceIds: string[];
}

export interface GmailBuilderNodeData extends BaseBuilderNodeData {
  kind: "gmail";
  integrationSlug: "gmail";
  connectionId: string | null;
  recipientMode: GmailRecipientMode;
  recipientEmail: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface GoogleCalendarBuilderNodeData extends BaseBuilderNodeData {
  kind: "googlecalendar";
  integrationSlug: "googlecalendar";
  connectionId: string | null;
  timezone: string | null;
  calendarId: string | null;
  calendarLabel: string | null;
  includePrimaryCalendar: boolean;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface CalBuilderNodeData extends BaseBuilderNodeData {
  kind: "cal";
  integrationSlug: "cal";
  connectionId: string | null;
  eventTypeMode: "ai_decides" | "specific_event_type";
  eventTypeId: string | null;
  eventTypeLabel: string | null;
  timezone: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface EndChatBuilderNodeData extends BaseBuilderNodeData {
  kind: "endchat";
  inactivityTimeoutSeconds: number | null;
  allowAssistantSuggestion: boolean;
}

export type BuilderNodeData =
  | TriggerBuilderNodeData
  | AgentBuilderNodeData
  | KnowledgeBuilderNodeData
  | GmailBuilderNodeData
  | GoogleCalendarBuilderNodeData
  | CalBuilderNodeData
  | EndChatBuilderNodeData;

export interface BuilderDefinition {
  nodes: unknown[];
  edges: unknown[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  config: {
    model: string;
    instructions: string;
    starterPrompts: string[];
    timezone: string;
  };
}