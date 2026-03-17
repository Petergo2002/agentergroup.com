import { getAppUrl, getWidgetAppUrl } from "@/lib/env";
import type {
  AgentRecord,
  WidgetDraftPreviewInput,
  WidgetAgentRecord,
  WidgetContactFormSettingsRecord,
  WidgetQuickAction,
  WidgetRecord,
  WidgetRuntimeConfig,
  WorkspaceRecord,
} from "@/lib/types";

export const WIDGET_DEFAULT_PRIMARY_COLOR = "#ff5c00";
export const WIDGET_DEFAULT_BACKGROUND_COLOR = "#0a0a0a";
export const WIDGET_DEFAULT_TEXT_COLOR = "#f5f5f5";
export const WIDGET_DEFAULT_GREETING = "Hi! How can I help you today?";
export const WIDGET_DEFAULT_PLACEHOLDER = "Write a message...";
export const WIDGET_DEFAULT_HOME_TITLE = "How can we help?";
export const WIDGET_DEFAULT_HOME_SUBTITLE =
  "Choose the right specialist to get started.";

export const WIDGET_DEFAULT_GREETING_SV = "Hej! Hur kan jag hjälpa dig idag?";
export const WIDGET_DEFAULT_PLACEHOLDER_SV = "Skriv ett meddelande...";
export const WIDGET_DEFAULT_HOME_TITLE_SV = "Hur kan vi hjälpa till?";
export const WIDGET_DEFAULT_HOME_SUBTITLE_SV =
  "Välj rätt specialist för att komma igång.";

export function getHomeTitleDefault(language: string) {
  return language === "sv" ? WIDGET_DEFAULT_HOME_TITLE_SV : WIDGET_DEFAULT_HOME_TITLE;
}

export function getHomeSubtitleDefault(language: string) {
  return language === "sv" ? WIDGET_DEFAULT_HOME_SUBTITLE_SV : WIDGET_DEFAULT_HOME_SUBTITLE;
}

export function getGreetingDefault(language: string) {
  return language === "sv" ? WIDGET_DEFAULT_GREETING_SV : WIDGET_DEFAULT_GREETING;
}

export function getPlaceholderDefault(language: string) {
  return language === "sv" ? WIDGET_DEFAULT_PLACEHOLDER_SV : WIDGET_DEFAULT_PLACEHOLDER;
}

export function buildDraftPreviewWidgetAgentId(agentId: string, sortOrder: number) {
  return `draft:${sortOrder}:${agentId}`;
}

export interface WidgetAgentWithAgent {
  widgetAgent: WidgetAgentRecord;
  agent: AgentRecord;
}

export function normalizeAllowedOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function normalizeAllowedOrigins(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeAllowedOrigin(value)).filter(Boolean)),
  ) as string[];
}

export function getDefaultWidgetBrandName(workspace: WorkspaceRecord) {
  return workspace.name;
}

export function getDefaultWidgetQuickActions(agent: AgentRecord): WidgetQuickAction[] {
  return agent.starter_prompts.slice(0, 3).map((prompt) => ({
    label: prompt,
    prompt,
    icon: null,
  }));
}

export function getDefaultContactFormSettings(): WidgetContactFormSettingsRecord {
  return {
    submitButtonText: "Send",
    successMessage: "Thanks! We'll get back to you soon.",
    introText: "Leave your details and we'll contact you.",
  };
}

export function buildDefaultWidgetInput(
  workspace: WorkspaceRecord,
  input?: { name?: string; slug?: string },
) {
  return {
    name: input?.name ?? "Untitled Widget",
    slug: input?.slug ?? "untitled-widget",
    status: "draft" as const,
    brand_name: getDefaultWidgetBrandName(workspace),
    logo_url: null,
    primary_color: WIDGET_DEFAULT_PRIMARY_COLOR,
    background_color: WIDGET_DEFAULT_BACKGROUND_COLOR,
    text_color: WIDGET_DEFAULT_TEXT_COLOR,
    theme: "dark" as const,
    language: "en",
    home_title: null,
    home_subtitle: null,
    show_branding: true,
    privacy_policy_url: `${getAppUrl()}/privacy-policy`,
    allowed_origins: [] as string[],
  };
}

export function buildDefaultWidgetAgentInput(agent: AgentRecord) {
  return {
    label: agent.name,
    description: agent.description || "",
    icon: null,
    sort_order: 0,
    interaction_mode: "chat" as const,
    greeting: WIDGET_DEFAULT_GREETING,
    placeholder: WIDGET_DEFAULT_PLACEHOLDER,
    show_quick_actions: true,
    quick_actions: getDefaultWidgetQuickActions(agent),
    contact_form_settings: getDefaultContactFormSettings(),
  };
}

function normalizeQuickActions(value: unknown, fallback: WidgetQuickAction[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const actions = value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      const icon =
        typeof record.icon === "string" && record.icon.trim()
          ? record.icon.trim()
          : null;

      if (!label || !prompt) {
        return null;
      }

      return {
        label,
        prompt,
        icon,
      };
    })
    .filter(Boolean) as WidgetQuickAction[];

  return actions.length > 0 ? actions : fallback;
}

function normalizeContactFormSettings(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return getDefaultContactFormSettings();
  }

  const record = value as Record<string, unknown>;
  return {
    submitButtonText:
      typeof record.submitButtonText === "string" && record.submitButtonText.trim()
        ? record.submitButtonText
        : "Send",
    successMessage:
      typeof record.successMessage === "string" && record.successMessage.trim()
        ? record.successMessage
        : "Thanks! We'll get back to you soon.",
    introText:
      typeof record.introText === "string" && record.introText.trim()
        ? record.introText
        : "Leave your details and we'll contact you.",
  };
}

export function buildWidgetRuntimeConfig(
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
  options?: { preview?: boolean },
): WidgetRuntimeConfig {
  const orderedAgents = [...widgetAgents].sort(
    (left, right) => left.widgetAgent.sort_order - right.widgetAgent.sort_order,
  );

  return {
    widgetId: widget.id,
    widgetPublicKey: widget.widget_public_key,
    preview: options?.preview ?? false,
    brand: {
      name: widget.brand_name,
      logoUrl: widget.logo_url,
      privacyPolicyUrl: widget.privacy_policy_url,
    },
    widget: {
      theme: widget.theme,
      primaryColor: widget.primary_color,
      backgroundColor: widget.background_color,
      textColor: widget.text_color,
      language: widget.language,
      showBranding: widget.show_branding,
    },
    home: {
      mode: orderedAgents.length === 1 ? "single_auto" : "chooser",
      title: widget.home_title || getHomeTitleDefault(widget.language),
      subtitle: orderedAgents.length <= 1 ? null : (widget.home_subtitle || getHomeSubtitleDefault(widget.language)),
    },
    agents: orderedAgents.map(({ widgetAgent, agent }) => ({
      widgetAgentId: widgetAgent.id,
      agentId: widgetAgent.agent_id,
      label: agent.name,
      description: widgetAgent.description,
      icon: widgetAgent.icon,
      interactionMode: widgetAgent.interaction_mode,
      greeting: widgetAgent.greeting || getGreetingDefault(widget.language),
      placeholder: widgetAgent.placeholder || getPlaceholderDefault(widget.language),
      quickActions: getDefaultWidgetQuickActions(agent),
      contactFormSettings: normalizeContactFormSettings(
        widgetAgent.contact_form_settings,
      ),
    })),
  };
}

export function buildWidgetRuntimeConfigFromDraft(
  widget: WidgetRecord,
  draft: WidgetDraftPreviewInput,
  options?: { preview?: boolean },
): WidgetRuntimeConfig {
  const orderedAgents = [...draft.agents].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  return {
    widgetId: widget.id,
    widgetPublicKey: widget.widget_public_key,
    preview: options?.preview ?? false,
    brand: {
      name: draft.widget.brandName.trim() || widget.brand_name,
      logoUrl: draft.widget.logoUrl.trim() || null,
      privacyPolicyUrl: draft.widget.privacyPolicyUrl.trim() || null,
    },
    widget: {
      theme: draft.widget.theme,
      primaryColor: draft.widget.primaryColor,
      backgroundColor: draft.widget.backgroundColor,
      textColor: draft.widget.textColor,
      language: draft.widget.language || "en",
      showBranding: draft.widget.showBranding,
    },
    home: {
      mode: orderedAgents.length === 1 ? "single_auto" : "chooser",
      title: draft.widget.homeTitle || getHomeTitleDefault(draft.widget.language || "en"),
      subtitle: orderedAgents.length <= 1 ? null : (draft.widget.homeSubtitle || getHomeSubtitleDefault(draft.widget.language || "en")),
    },
    agents: orderedAgents.map((agent, index) => ({
      widgetAgentId: buildDraftPreviewWidgetAgentId(agent.agentId, index),
      agentId: agent.agentId,
      label: agent.label.trim() || "AI Agent",
      description: agent.description.trim(),
      icon: agent.icon?.trim() || null,
      interactionMode: agent.interactionMode,
      greeting: agent.greeting.trim() || getGreetingDefault(draft.widget.language || "en"),
      placeholder: agent.placeholder.trim() || getPlaceholderDefault(draft.widget.language || "en"),
      quickActions: normalizeQuickActions(agent.quickActions, []),
      contactFormSettings: normalizeContactFormSettings(agent.contactFormSettings),
    })),
  };
}

export function buildHostedWidgetUrl(widgetPublicKey: string) {
  const widgetAppUrl = getWidgetAppUrl();
  return `${widgetAppUrl}/?widget=${encodeURIComponent(widgetPublicKey)}`;
}

export function buildWidgetEmbedSnippet(widgetPublicKey: string) {
  const widgetAppUrl = getWidgetAppUrl();
  return `<script src="${widgetAppUrl}/loader.js" data-widget="${widgetPublicKey}"></script>`;
}
