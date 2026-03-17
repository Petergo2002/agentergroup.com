export type WidgetLanguage = "sv" | "en";
export type WidgetTheme = "dark" | "light";

export interface WidgetQuickAction {
  label: string;
  prompt: string;
  icon?: string | null;
}

export interface WidgetAgentConfig {
  widgetAgentId: string;
  agentId: string;
  label: string;
  description: string;
  icon?: string | null;
  interactionMode: "chat";
  greeting: string;
  placeholder: string;
  quickActions: WidgetQuickAction[];
}

export interface WidgetConfig {
  widgetId: string;
  widgetPublicKey: string;
  preview: boolean;
  brand: {
    name: string;
    logoUrl: string | null;
    privacyPolicyUrl: string | null;
  };
  widget: {
    language?: WidgetLanguage;
    theme: WidgetTheme;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    showBranding: boolean;
  };
  home: {
    mode: "single_auto" | "chooser";
    title: string;
    subtitle: string | null;
  };
  agents: WidgetAgentConfig[];
}

export interface WidgetPreviewOverride {
  brand?: Partial<WidgetConfig["brand"]>;
  widget?: Partial<WidgetConfig["widget"]>;
  home?: Partial<WidgetConfig["home"]>;
  agent?: Partial<
    Pick<
      WidgetAgentConfig,
      "label" | "description" | "icon" | "greeting" | "placeholder"
    >
  >;
}

export interface Message {
  role: "user" | "agent";
  content: string;
  isStreaming?: boolean;
}
