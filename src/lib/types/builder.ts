import type { BuilderNodeKind, BuilderNodeStatus, BuilderNodeBadgeTone } from "./enums";
import type { GmailRecipientMode } from "./policy";

export type BuilderTriggerProvider = "internal" | "composio";

export type BuilderTriggerSource = "user_message" | "gmail_new_message";

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
  enabledTools?: string[];
}

export interface TriggerBuilderNodeData extends BaseBuilderNodeData {
  kind: "trigger";
  locked: true;
  triggerSource: BuilderTriggerSource;
  provider: BuilderTriggerProvider;
  toolkitSlug?: string | null;
  triggerSlug?: string | null;
  connectionId?: string | null;
  triggerConfig?: Record<string, unknown>;
}

export interface AgentBuilderNodeData extends BaseBuilderNodeData {
  kind: "agent";
  showConfidence?: boolean;
  confidenceValue?: number;
  confidenceLabel?: string;
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

export interface OutlookBuilderNodeData extends BaseBuilderNodeData {
  kind: "outlook";
  integrationSlug: "outlook";
  connectionId: string | null;
  recipientMode: GmailRecipientMode;
  recipientEmail: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface SlackBuilderNodeData extends BaseBuilderNodeData {
  kind: "slack";
  integrationSlug: "slack";
  connectionId: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface HubSpotBuilderNodeData extends BaseBuilderNodeData {
  kind: "hubspot";
  integrationSlug: "hubspot";
  connectionId: string | null;
  simpleIcon?: string;
  simpleIconColor?: string;
}

export interface ShopifyBuilderNodeData extends BaseBuilderNodeData {
  kind: "shopify";
  integrationSlug: "shopify";
  connectionId: string | null;
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
  | OutlookBuilderNodeData
  | SlackBuilderNodeData
  | HubSpotBuilderNodeData
  | ShopifyBuilderNodeData
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
    trigger?: {
      source: BuilderTriggerSource;
      provider: BuilderTriggerProvider;
      toolkitSlug?: string | null;
      triggerSlug?: string | null;
      triggerConfig?: Record<string, unknown>;
      connectionId?: string | null;
    };
    automation?: {
      triggerSlug: string;
      triggerConfig: Record<string, unknown>;
      connectionId: string | null;
    };
  };
}
