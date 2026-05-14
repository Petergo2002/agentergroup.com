import { detectBrowserLanguage, getLocalizedText, WIDGET_DEFAULTS } from "./localization";
import type { WidgetConfig, WidgetAgentConfig } from "../types";

export function normalizeWidgetConfig(config: WidgetConfig): WidgetConfig {
  const language = resolveWidgetLanguage(config);
  const d = WIDGET_DEFAULTS[language];

  const normalizedAgents = Array.isArray(config.agents)
    ? config.agents
        .map((agent) => {
          if (!agent || typeof agent !== "object") {
            return null;
          }

          return {
            widgetAgentId: String(agent.widgetAgentId ?? "").trim(),
            agentId: String(agent.agentId ?? "").trim(),
            label: agent.label?.trim() || d.agentLabel,
            description: agent.description?.trim() || "",
            icon:
              typeof agent.icon === "string" && agent.icon.trim()
                ? agent.icon.trim()
                : null,
            interactionMode:
              agent.interactionMode === "contact_form"
                ? "contact_form"
                : "chat",
            greeting: getLocalizedText(agent.greeting, "greeting", language),
            placeholder: getLocalizedText(agent.placeholder, "placeholder", language),
            showQuickActions: agent.showQuickActions !== false,
            quickActions: Array.isArray(agent.quickActions)
              ? agent.quickActions
              : [],
            endChatPolicy: {
              enabled: Boolean(agent.endChatPolicy?.enabled),
              inactivityTimeoutSeconds:
                typeof agent.endChatPolicy?.inactivityTimeoutSeconds === "number" &&
                agent.endChatPolicy.inactivityTimeoutSeconds > 0
                  ? Math.round(agent.endChatPolicy.inactivityTimeoutSeconds)
                  : null,
              allowAssistantSuggestion:
                agent.endChatPolicy?.allowAssistantSuggestion !== false,
            },
          } satisfies WidgetAgentConfig;
        })
        .filter(Boolean) as WidgetAgentConfig[]
    : [];

  return {
    ...config,
    widgetId: config.widgetId || config.widgetPublicKey,
    brand: {
      name: config.brand?.name || "Agent",
      logoUrl: config.brand?.logoUrl ?? null,
      privacyPolicyUrl: config.brand?.privacyPolicyUrl ?? null,
    },
    widget: {
      language: config.widget?.language ?? detectBrowserLanguage(),
      theme: config.widget?.theme === "light" ? "light" : "dark",
      primaryColor: config.widget?.primaryColor || "#ff5c00",
      secondaryColor:
        config.widget?.secondaryColor ||
        config.widget?.primaryColor ||
        "#ff5c00",
      backgroundColor: config.widget?.backgroundColor,
      textColor: config.widget?.textColor,
      showBranding: config.widget?.showBranding ?? true,
    },
    home: {
      mode:
        config.home?.mode === "single_auto" && normalizedAgents.length === 1
          ? "single_auto"
          : "chooser",
      title: getLocalizedText(config.home?.title, "homeTitle", language),
      subtitle: config.home?.subtitle ?? null,
    },
    agents: normalizedAgents,
  };
}

export function resolveWidgetLanguage(config: WidgetConfig | null): "sv" | "en" {
  return config?.widget.language ?? detectBrowserLanguage();
}

export function resolveSelectedAgent(
  config: WidgetConfig | null,
  selectedWidgetAgentId: string | null,
) {
  if (!config) return null;

  if (selectedWidgetAgentId) {
    return (
      config.agents.find(
        (agent) => agent.widgetAgentId === selectedWidgetAgentId,
      ) ?? null
    );
  }

  if (config.home.mode === "single_auto") {
    return config.agents[0] ?? null;
  }

  return null;
}
