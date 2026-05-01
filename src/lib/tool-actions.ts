import type { BuilderDefinition } from "@/lib/types";
import {
  getRecommendedChatToolsForToolkit,
  isChatIntegrationSlug,
  isToolNameForToolkit,
} from "@/lib/integrations";

export type EnabledToolSelection = Record<string, string[]>;

function normalizeToolList(toolkitSlug: string, values: unknown) {
  if (!Array.isArray(values)) {
    return null;
  }

  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          /^[A-Z0-9_]+$/.test(value) &&
          isToolNameForToolkit(value, toolkitSlug),
      ),
    ),
  );
}

export function getEnabledToolsForToolkit(
  toolkitSlug: string,
  explicitTools: unknown,
) {
  const normalized = normalizeToolList(toolkitSlug, explicitTools);
  return normalized ?? getRecommendedChatToolsForToolkit(toolkitSlug);
}

export function extractEnabledToolsFromDefinition(
  definition: BuilderDefinition | null | undefined,
) {
  const selection: EnabledToolSelection = {};

  if (!Array.isArray(definition?.nodes)) {
    return selection;
  }

  for (const node of definition.nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const data = (node as { data?: Record<string, unknown> }).data;
    const toolkitSlug =
      typeof data?.integrationSlug === "string"
        ? data.integrationSlug
        : typeof data?.kind === "string"
          ? data.kind
          : null;

    if (!toolkitSlug || !isChatIntegrationSlug(toolkitSlug)) {
      continue;
    }

    selection[toolkitSlug] = getEnabledToolsForToolkit(
      toolkitSlug,
      data?.enabledTools,
    );
  }

  return selection;
}

