import type { WidgetDeploymentStatus } from "./enums";
import type { WidgetQuickAction, WidgetContactFormSettingsRecord } from "./widget-shared";
import type { ConversationEndReason } from "./policy";

export interface WidgetDeploymentRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  published_version_id: string | null;
  status: WidgetDeploymentStatus;
  widget_public_key: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  theme: "dark" | "light";
  language: string;
  home_title: string | null;
  home_subtitle: string | null;
  hosted_enabled: boolean;
  greeting: string;
  placeholder: string;
  show_branding: boolean;
  privacy_policy_url: string | null;
  interaction_mode: "chat" | "contact_form";
  allowed_origins: string[];
  quick_actions: WidgetQuickAction[];
  contact_form_settings: WidgetContactFormSettingsRecord;
  description: string;
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

export interface WidgetRecord {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: WidgetDeploymentStatus;
  widget_public_key: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  theme: "dark" | "light";
  language: string;
  home_title: string | null;
  home_subtitle: string | null;
  hosted_enabled: boolean;
  show_branding: boolean;
  privacy_policy_url: string | null;
  allowed_origins: string[];
  description: string;
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

export interface WidgetAgentRecord {
  id: string;
  widget_id: string;
  agent_id: string;
  published_version_id: string | null;
  label: string;
  description: string;
  icon: string | null;
  sort_order: number;
  interaction_mode: "chat" | "contact_form";
  greeting: string;
  placeholder: string;
  show_quick_actions: boolean;
  quick_actions: WidgetQuickAction[];
  contact_form_settings: WidgetContactFormSettingsRecord;
  created_at: string;
  updated_at: string;
}

export interface WidgetSessionRecord {
  id: string;
  widget_id: string;
  session_id: string;
  source: "embedded" | "hosted" | "preview";
  status: "active" | "completed";
  active_turn_request_id: string | null;
  active_turn_started_at: string | null;
  page_url: string | null;
  referrer: string | null;
  origin: string | null;
  active_widget_agent_id: string | null;
  active_agent_id: string | null;
  ended_at: string | null;
  end_reason: ConversationEndReason | null;
  last_user_message_at: string | null;
  last_assistant_message_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface WidgetSessionMessageRecord {
  id: string;
  widget_session_id: string;
  widget_id: string;
  widget_agent_id: string | null;
  agent_id: string | null;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WidgetLeadRecord {
  id: string;
  widget_id: string;
  widget_session_id: string | null;
  widget_agent_id: string | null;
  agent_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  created_at: string;
}
