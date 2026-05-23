import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
  BuilderDefinition,
} from "./types.ts";

const TOOL_NODE_KINDS = new Set([
  "gmail",
  "outlook",
  "slack",
  "hubspot",
  "shopify",
  "googleads",
  "googlecalendar",
  "cal",
]);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slugifyTemplateName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeNodeData(data: unknown) {
  if (!isObject(data)) {
    return data;
  }

  const next = { ...data };
  const kind = typeof next.kind === "string" ? next.kind : null;

  if ("connectionId" in next) {
    next.connectionId = null;
  }

  if (kind === "knowledge") {
    next.sourceIds = [];
    next.folderIds = [];
  }

  if (kind === "googlecalendar") {
    next.calendarId = null;
    next.calendarLabel = null;
    next.timezone = null;
  }

  if (kind === "cal") {
    next.eventTypeMode = "ai_decides";
    next.eventTypeId = null;
    next.eventTypeLabel = null;
    next.timezone = null;
  }

  if (kind === "trigger" && next.provider === "composio") {
    next.connectionId = null;
    next.triggerConfig = {};
  }

  return next;
}

export function sanitizeBuilderDefinitionForTemplate(
  definition: BuilderDefinition,
): BuilderDefinition {
  const sanitized = cloneJson(definition);

  sanitized.nodes = Array.isArray(sanitized.nodes)
    ? sanitized.nodes.map((node) => {
        if (!isObject(node)) {
          return node;
        }

        return {
          ...node,
          data: sanitizeNodeData(node.data),
        };
      })
    : [];

  sanitized.edges = Array.isArray(sanitized.edges) ? sanitized.edges : [];
  sanitized.config = {
    ...sanitized.config,
    trigger: sanitized.config?.trigger
      ? {
          ...sanitized.config.trigger,
          connectionId: null,
          triggerConfig:
            sanitized.config.trigger.provider === "composio"
              ? {}
              : sanitized.config.trigger.triggerConfig ?? {},
        }
      : sanitized.config?.trigger,
    automation: sanitized.config?.automation
      ? {
          ...sanitized.config.automation,
          connectionId: null,
          triggerConfig: {},
        }
      : sanitized.config?.automation,
  };

  return sanitized;
}

export function getKnowledgeSourceIdsFromDefinition(
  definition: BuilderDefinition,
) {
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const ids = nodes.flatMap((node) => {
    if (!isObject(node) || !isObject(node.data) || node.data.kind !== "knowledge") {
      return [];
    }

    return Array.isArray(node.data.sourceIds)
      ? node.data.sourceIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
  });

  return Array.from(new Set(ids));
}

export function getKnowledgeFolderIdsFromDefinition(
  definition: BuilderDefinition,
) {
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const ids = nodes.flatMap((node) => {
    if (!isObject(node) || !isObject(node.data) || node.data.kind !== "knowledge") {
      return [];
    }

    return Array.isArray(node.data.folderIds)
      ? node.data.folderIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
  });

  return Array.from(new Set(ids));
}

export function getRequiredIntegrationsFromDefinition(
  definition: BuilderDefinition,
) {
  const integrations = new Set<string>();
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];

  for (const node of nodes) {
    if (!isObject(node) || !isObject(node.data)) {
      continue;
    }

    const kind = typeof node.data.kind === "string" ? node.data.kind : null;
    const integrationSlug =
      typeof node.data.integrationSlug === "string" ? node.data.integrationSlug : null;

    if (integrationSlug) {
      integrations.add(integrationSlug);
    } else if (kind && TOOL_NODE_KINDS.has(kind)) {
      integrations.add(kind);
    }

    if (
      kind === "trigger" &&
      node.data.provider === "composio" &&
      typeof node.data.toolkitSlug === "string"
    ) {
      integrations.add(node.data.toolkitSlug);
    }
  }

  const trigger = definition.config?.trigger;
  if (trigger?.provider === "composio" && trigger.toolkitSlug) {
    integrations.add(trigger.toolkitSlug);
  }

  return Array.from(integrations).sort();
}

export function applyImportedKnowledgeSourceIds(
  definition: BuilderDefinition,
  sourceIds: string[],
): BuilderDefinition {
  const next = cloneJson(definition);
  const nodes = Array.isArray(next.nodes) ? next.nodes : [];

  next.nodes = nodes.map((node) => {
    if (!isObject(node) || !isObject(node.data) || node.data.kind !== "knowledge") {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        sourceIds,
        folderIds: [],
      },
    };
  });

  return next;
}

export function buildTemplateSlug(name: string) {
  const base = slugifyTemplateName(name) || "agent-template";
  return `${base}-${Date.now().toString().slice(-8)}`;
}

export function buildImportedAgentSlug(name: string) {
  const base = slugifyTemplateName(name) || "agent";
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export function buildContentFromKnowledgeChunks(
  chunks: Array<{ chunk_index: number; content: string }>,
) {
  return [...chunks]
    .sort((left, right) => left.chunk_index - right.chunk_index)
    .map((chunk) => chunk.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function buildTemplateSourcePreview(
  source: Pick<AgentLibraryTemplateSourceRecord, "content_text">,
  maxLength = 600,
) {
  const text = source.content_text.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

export function toLibraryTemplateListItem(
  template: AgentLibraryTemplateRecord,
) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    surface: template.surface,
    model: template.model,
    requiredIntegrations: template.required_integrations,
    knowledgeSourceCount: template.knowledge_source_count,
    createdAt: template.created_at,
  };
}
