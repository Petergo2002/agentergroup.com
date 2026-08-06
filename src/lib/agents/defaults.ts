import { slugify } from "@/lib/utils";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import { OPENROUTER_DEFAULT_AGENT_MODEL } from "@/lib/openrouter-models";
import type { AgentSurface, BuilderDefinition } from "@/lib/types";

export const SUPPORTED_TOOLKITS = SUPPORTED_INTEGRATIONS.map((integration) => ({
  slug: integration.slug,
  displayName: integration.displayName,
  description: integration.description,
  icon: integration.icon,
  category: integration.category,
}));

export const AUTOMATION_GMAIL_TRIGGER_SLUG = "GMAIL_NEW_GMAIL_MESSAGE";
export const AUTOMATION_GMAIL_TRIGGER_CONFIG = {
  interval: 15,
  labelIds: "INBOX",
  query: "",
  userId: "me",
} as const;

const TEMPLATE_PRESETS = {
  support: {
    name: "Customer Support Agent",
    description: "Handle customer questions, order lookups, and support escalations.",
    instructions:
      "You are a customer support specialist. Be concise, empathetic, and action-oriented. Use connected tools when needed and summarize next steps clearly.",
    starterPrompts: [
      "Check the status of order #1428",
      "Summarize open support issues from Slack",
      "Draft a reply to a refund request",
    ],
  },
  research: {
    name: "Research Agent",
    description: "Synthesize information from connected tools and deliver concise findings.",
    instructions:
      "You are a research analyst. Verify details before answering, cite tool outputs clearly, and organize findings into concise recommendations.",
    starterPrompts: [
      "Summarize the latest activity in the sales pipeline",
      "Find the top unresolved support themes",
      "Draft a research brief for customer churn risk",
    ],
  },
  marketing: {
    name: "Content Creator Agent",
    description: "Generate campaign copy, social posts, and launch assets with channel context.",
    instructions:
      "You are a senior growth marketer. Match tone to the channel, keep copy conversion-focused, and reuse context from connected systems when available.",
    starterPrompts: [
      "Write a launch post for our new feature",
      "Draft a follow-up email for trial users",
      "Summarize this week’s product updates for LinkedIn",
    ],
  },
  custom: {
    name: "Custom Agent",
    description: "A focused conversational agent that can answer from knowledge and use tools when needed.",
    instructions:
      "You are a helpful AI agent. Answer clearly, use the attached knowledge base before guessing, and only use connected tools when they are needed to complete the current conversation.",
    starterPrompts: [
      "What can you help me with?",
      "Answer using the attached knowledge base",
      "Use a connected tool if you need live information",
    ],
  },
} as const;

export function getTemplatePreset(templateId: string) {
  return TEMPLATE_PRESETS[templateId as keyof typeof TEMPLATE_PRESETS] ?? TEMPLATE_PRESETS.custom;
}

export function buildInitialDefinition(
  templateId: string,
  surface: AgentSurface = "widget",
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): BuilderDefinition {
  const preset = getTemplatePreset(templateId);
  const isAutomation = surface === "automation";

  return {
    nodes: [
      {
        id: "trigger",
        type: "agentNode",
        position: { x: 40, y: 150 },
        data: {
          kind: "trigger",
          label: isAutomation ? "External Trigger" : "Chat Message",
          type: "Trigger",
          icon: isAutomation ? "mail" : "chat",
          description: isAutomation
            ? "Starts from a connected external app event."
            : "Runs when a visitor sends a chat message.",
          status: "idle",
          locked: true,
          triggerSource: isAutomation ? "gmail_new_message" : "user_message",
          provider: isAutomation ? "composio" : "internal",
          toolkitSlug: isAutomation ? "gmail" : null,
          triggerSlug: isAutomation ? AUTOMATION_GMAIL_TRIGGER_SLUG : null,
          connectionId: null,
          triggerConfig: isAutomation ? { ...AUTOMATION_GMAIL_TRIGGER_CONFIG } : {},
        },
      },
      {
        id: "agent",
        type: "agentNode",
        position: { x: 320, y: 150 },
        data: {
          kind: "agent",
          label: isAutomation ? "Automation Logic" : "Agent",
          type: isAutomation ? "Decision" : "Core",
          icon: "smart_toy",
          description: isAutomation
            ? "Analyzes each event and decides which configured actions are required."
            : "Uses the selected model, instructions, and context.",
          status: "active",
          showConfidence: true,
          confidenceValue: 82,
          automationMode: isAutomation,
          locked: true,
        },
      },
    ],
    edges: [
      {
        id: "e-trigger-agent",
        source: "trigger",
        target: "agent",
        animated: true,
        style: { stroke: "var(--color-primary)", strokeWidth: 2 },
      },
    ],
    viewport: { x: 0, y: 0, zoom: 0.95 },
    config: {
      model: OPENROUTER_DEFAULT_AGENT_MODEL,
      instructions: isAutomation
        ? "Inspect each incoming event, decide whether the event requires action under these instructions, and use only the configured actions needed to complete it. If no action is needed, record that clearly. Never claim an external action succeeded unless its tool call succeeded."
        : preset.instructions,
      starterPrompts: isAutomation ? [] : [...preset.starterPrompts],
      timezone,
      trigger: {
        source: isAutomation ? "gmail_new_message" : "user_message",
        provider: isAutomation ? "composio" : "internal",
        toolkitSlug: isAutomation ? "gmail" : null,
        triggerSlug: isAutomation ? AUTOMATION_GMAIL_TRIGGER_SLUG : null,
        triggerConfig: isAutomation ? { ...AUTOMATION_GMAIL_TRIGGER_CONFIG } : {},
        connectionId: null,
      },
    },
  };
}

export function buildAgentPayload(
  templateId: string,
  customName: string,
  surface: AgentSurface = "widget",
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const preset = getTemplatePreset(templateId);
  const name = customName.trim() || preset.name;
  const isAutomation = surface === "automation";

  return {
    name,
    slug: `${slugify(name)}-${Date.now().toString().slice(-6)}`,
    description: isAutomation
      ? "Runs from a connected external trigger and processes incoming events."
      : preset.description,
    status: "draft" as const,
    surface,
    model: OPENROUTER_DEFAULT_AGENT_MODEL,
    instructions: isAutomation
      ? "Inspect each incoming event, decide whether the event requires action under these instructions, and use only the configured actions needed to complete it. If no action is needed, record that clearly. Never claim an external action succeeded unless its tool call succeeded."
      : preset.instructions,
    starter_prompts: isAutomation ? [] : [...preset.starterPrompts],
    timezone,
  };
}
