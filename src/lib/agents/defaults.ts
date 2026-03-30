import { slugify } from "@/lib/utils";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import type { AgentSurface, BuilderDefinition } from "@/lib/types";

export const SUPPORTED_TOOLKITS = SUPPORTED_INTEGRATIONS.map((integration) => ({
  slug: integration.slug,
  displayName: integration.displayName,
  description: integration.description,
  icon: integration.icon,
  category: integration.category,
}));

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

export function buildInitialDefinition(templateId: string): BuilderDefinition {
  const preset = getTemplatePreset(templateId);

  return {
    nodes: [
      {
        id: "trigger",
        type: "agentNode",
        position: { x: 40, y: 150 },
        data: {
          kind: "trigger",
          label: "User Message",
          type: "Trigger",
          icon: "input",
          description: "Starting point for the current conversation.",
          status: "idle",
          locked: true,
        },
      },
      {
        id: "agent",
        type: "agentNode",
        position: { x: 320, y: 150 },
        data: {
          kind: "agent",
          label: "Agent",
          type: "Core",
          icon: "smart_toy",
          description: "Uses the selected model, instructions, and conversation context.",
          status: "active",
          showConfidence: true,
          confidenceValue: 82,
          locked: true,
        },
      },
      {
        id: "response",
        type: "agentNode",
        position: { x: 920, y: 150 },
        data: {
          kind: "output",
          label: "Assistant Response",
          type: "Output",
          icon: "send",
          description: "Returns the final response to the user.",
          status: "idle",
          locked: true,
        },
      },
    ],
    edges: [
      {
        id: "e-trigger-model",
        source: "trigger",
        target: "agent",
        animated: true,
        style: { stroke: "var(--color-primary)", strokeWidth: 2 },
      },
      {
        id: "e-agent-response",
        source: "agent",
        target: "response",
        style: { stroke: "var(--color-outline-variant)", strokeWidth: 2, opacity: 0.45 },
      },
    ],
    viewport: { x: 0, y: 0, zoom: 0.95 },
    config: {
      model: "openai/gpt-4o-mini",
      instructions: preset.instructions,
      starterPrompts: [...preset.starterPrompts],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

export function buildAgentPayload(
  templateId: string,
  customName: string,
  surface: AgentSurface = "widget",
) {
  const preset = getTemplatePreset(templateId);
  const name = customName.trim() || preset.name;

  return {
    name,
    slug: `${slugify(name)}-${Date.now().toString().slice(-6)}`,
    description: preset.description,
    status: "draft" as const,
    surface,
    model: "openai/gpt-4o-mini",
    instructions: preset.instructions,
    starter_prompts: [...preset.starterPrompts],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
