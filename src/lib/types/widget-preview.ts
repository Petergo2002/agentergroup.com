import type { WidgetQuickAction, WidgetContactFormSettingsRecord } from "./widget-shared";
import type { EndChatPolicy, GmailRecipientPolicy, GoogleCalendarSelection, CalSelection } from "./policy";

export interface WidgetDraftPreviewAgentInput {
  agentId: string;
  label: string;
  description: string;
  icon: string | null;
  sortOrder: number;
  interactionMode: "chat" | "contact_form";
  greeting: string;
  placeholder: string;
  showQuickActions: boolean;
  quickActions: WidgetQuickAction[];
  contactFormSettings: WidgetContactFormSettingsRecord;
}

export interface WidgetDraftPreviewInput {
  widget: {
    name: string;
    brandName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor?: string;
    textColor?: string;
    theme: "dark" | "light";
    language: string;
    homeTitle: string | null;
    homeSubtitle: string | null;
    showBranding: boolean;
    privacyPolicyUrl: string;
    allowedOrigins: string[];
  };
  agents: WidgetDraftPreviewAgentInput[];
}

export interface WidgetPreviewDraftRecord {
  id: string;
  widget_id: string;
  workspace_id: string;
  created_by: string;
  revision: string;
  payload: WidgetDraftPreviewInput;
  expires_at: string;
  created_at: string;
}

export interface WidgetRuntimeConfig {
  widgetId: string;
  widgetPublicKey: string;
  preview: boolean;
  brand: {
    name: string;
    logoUrl: string | null;
    privacyPolicyUrl: string | null;
  };
  widget: {
    theme: "dark" | "light";
    primaryColor: string;
    secondaryColor: string;
    backgroundColor?: string;
    textColor?: string;
    language: string;
    showBranding: boolean;
  };
  home: {
    mode: "single_auto" | "chooser";
    title: string | null;
    subtitle: string | null;
  };
  agents: Array<{
    widgetAgentId: string;
    agentId: string;
    label: string;
    description: string;
    icon: string | null;
    interactionMode: "chat" | "contact_form";
    greeting: string;
    placeholder: string;
    showQuickActions: boolean;
    quickActions: WidgetQuickAction[];
    contactFormSettings: WidgetContactFormSettingsRecord;
    endChatPolicy: EndChatPolicy;
    gmailRecipientPolicy: GmailRecipientPolicy;
    googleCalendarSelection: GoogleCalendarSelection;
    calSelection: CalSelection;
  }>;
}
