import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { extractCalSelectionFromDefinition } from "@/lib/cal";
import type {
  AgentRecord,
  AgentVersionRecord,
  BuilderDefinition,
  CalSelection,
  EndChatPolicy,
  GmailRecipientPolicy,
  GoogleCalendarSelection,
  WidgetDraftPreviewInput,
  WidgetRecord,
} from "@/lib/types";
import {
  buildDraftPreviewWidgetAgentId,
  buildHostedWidgetUrl,
  buildWidgetEmbedSnippet,
  buildWidgetRuntimeConfig,
  buildWidgetRuntimeConfigFromDraft,
  type WidgetAgentWithAgent,
} from "@/lib/widgets";
import {
  WIDGET_ACTIVE_TURN_STALE_MS,
  DEPLOY_TIMESTAMP_SKEW_MS,
  type WidgetAdminSupabase,
  type AgentDraftDefinitionRow,
  type AgentVersionDefinitionRow,
  type RuntimeWidgetAgentSelection,
} from "./server-types";
import { loadWidgetAgentsByIds } from "./loader";

export function getWidgetRuntimeAgent(
  agent: AgentRecord,
  version: AgentVersionRecord | null,
) {
  const config = version?.definition?.config;

  return {
    ...agent,
    model: config?.model ?? agent.model,
    instructions: config?.instructions ?? agent.instructions,
    timezone: config?.timezone ?? agent.timezone ?? 'UTC',
  };
}

async function loadAgentDraftDefinitionsByAgentId(
  supabase: WidgetAdminSupabase,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return new Map<string, BuilderDefinition>();
  }

  const { data, error } = await (supabase
    .from("agent_drafts")
    .select("agent_id, definition")
    .in("agent_id", agentIds) as unknown as Promise<{
    data: AgentDraftDefinitionRow[] | null;
    error: { message: string } | null;
  }>);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as AgentDraftDefinitionRow[])
      .filter((row) => row.definition)
      .map((row) => [row.agent_id, row.definition as BuilderDefinition]),
  );
}

async function loadAgentVersionDefinitionsById(
  supabase: WidgetAdminSupabase,
  versionIds: string[],
) {
  if (versionIds.length === 0) {
    return new Map<string, BuilderDefinition>();
  }

  const { data, error } = await (supabase
    .from("agent_versions")
    .select("id, definition")
    .in("id", versionIds) as unknown as Promise<{
    data: AgentVersionDefinitionRow[] | null;
    error: { message: string } | null;
  }>);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as AgentVersionDefinitionRow[])
      .filter((row) => row.definition)
      .map((row) => [row.id, row.definition as BuilderDefinition]),
  );
}

function buildAgentPolicyMapsFromVersionDefinitions(
  widgetAgents: WidgetAgentWithAgent[],
  definitionsByVersionId: Map<string, BuilderDefinition>,
) {
  const endChatPoliciesByAgentId = new Map<string, EndChatPolicy>();
  const gmailRecipientPoliciesByAgentId = new Map<string, GmailRecipientPolicy>();
  const googleCalendarSelectionsByAgentId = new Map<
    string,
    GoogleCalendarSelection
  >();
  const calSelectionsByAgentId = new Map<string, CalSelection>();

  for (const { widgetAgent, agent } of widgetAgents) {
    const definition = widgetAgent.published_version_id
      ? definitionsByVersionId.get(widgetAgent.published_version_id)
      : null;

    endChatPoliciesByAgentId.set(
      agent.id,
      extractEndChatPolicyFromDefinition(definition),
    );
    gmailRecipientPoliciesByAgentId.set(
      agent.id,
      extractGmailRecipientPolicyFromDefinition(definition),
    );
    googleCalendarSelectionsByAgentId.set(
      agent.id,
      extractGoogleCalendarSelectionFromDefinition(definition),
    );
    calSelectionsByAgentId.set(
      agent.id,
      extractCalSelectionFromDefinition(definition),
    );
  }

  return {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  };
}

function buildAgentPolicyMapsFromDraftDefinitions(
  agentIds: string[],
  definitionsByAgentId: Map<string, BuilderDefinition>,
) {
  const endChatPoliciesByAgentId = new Map<string, EndChatPolicy>();
  const gmailRecipientPoliciesByAgentId = new Map<string, GmailRecipientPolicy>();
  const googleCalendarSelectionsByAgentId = new Map<
    string,
    GoogleCalendarSelection
  >();
  const calSelectionsByAgentId = new Map<string, CalSelection>();

  for (const agentId of agentIds) {
    const definition = definitionsByAgentId.get(agentId);
    endChatPoliciesByAgentId.set(
      agentId,
      extractEndChatPolicyFromDefinition(definition),
    );
    gmailRecipientPoliciesByAgentId.set(
      agentId,
      extractGmailRecipientPolicyFromDefinition(definition),
    );
    googleCalendarSelectionsByAgentId.set(
      agentId,
      extractGoogleCalendarSelectionFromDefinition(definition),
    );
    calSelectionsByAgentId.set(
      agentId,
      extractCalSelectionFromDefinition(definition),
    );
  }

  return {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  };
}

async function buildStoredAgentPolicyMapsByAgentId(
  supabase: WidgetAdminSupabase,
  widgetAgents: WidgetAgentWithAgent[],
) {
  const versionIds = Array.from(
    new Set(
      widgetAgents
        .map(({ widgetAgent }) => widgetAgent.published_version_id)
        .filter(Boolean) as string[],
    ),
  );
  const definitionsByVersionId = await loadAgentVersionDefinitionsById(
    supabase,
    versionIds,
  );
  return buildAgentPolicyMapsFromVersionDefinitions(
    widgetAgents,
    definitionsByVersionId,
  );
}

async function buildDraftAgentPolicyMapsByAgentId(
  supabase: WidgetAdminSupabase,
  draft: WidgetDraftPreviewInput,
) {
  const agentIds = Array.from(new Set(draft.agents.map((agent) => agent.agentId)));
  const definitionsByAgentId = await loadAgentDraftDefinitionsByAgentId(
    supabase,
    agentIds,
  );
  return buildAgentPolicyMapsFromDraftDefinitions(agentIds, definitionsByAgentId);
}

export async function buildStoredWidgetRuntimeConfig(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
  options?: { preview?: boolean },
) {
  const {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  } = await buildStoredAgentPolicyMapsByAgentId(
    supabase,
    widgetAgents,
  );

  return buildWidgetRuntimeConfig(widget, widgetAgents, {
    preview: options?.preview,
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  });
}

export async function buildDraftWidgetRuntimeConfig(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  draft: WidgetDraftPreviewInput,
  options?: { preview?: boolean },
) {
  const {
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  } = await buildDraftAgentPolicyMapsByAgentId(
    supabase,
    draft,
  );

  return buildWidgetRuntimeConfigFromDraft(widget, draft, {
    preview: options?.preview,
    endChatPoliciesByAgentId,
    gmailRecipientPoliciesByAgentId,
    googleCalendarSelectionsByAgentId,
    calSelectionsByAgentId,
  });
}

export function getWidgetNeedsRedeploy(
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
) {
  if (widget.status !== "deployed") {
    return false;
  }

  if (!widget.deployed_at || widgetAgents.length === 0) {
    return true;
  }

  const deployedAt = new Date(widget.deployed_at).getTime();
  const widgetUpdatedAt = new Date(widget.updated_at).getTime();

  if (widgetUpdatedAt - deployedAt > DEPLOY_TIMESTAMP_SKEW_MS) {
    return true;
  }

  return widgetAgents.some(({ widgetAgent, agent }) => {
    const widgetAgentUpdatedAt = new Date(widgetAgent.updated_at).getTime();
    return (
      widgetAgentUpdatedAt - deployedAt > DEPLOY_TIMESTAMP_SKEW_MS ||
      widgetAgent.published_version_id !== agent.published_version_id
    );
  });
}

export function buildWidgetSummary(
  widget: WidgetRecord,
  widgetAgents: WidgetAgentWithAgent[],
  options?: { preview?: boolean },
) {
  return {
    widget,
    attachedAgents: widgetAgents,
    runtimeConfig: buildWidgetRuntimeConfig(widget, widgetAgents, options),
    hostedUrl: buildHostedWidgetUrl(widget.widget_public_key),
    embedSnippet: buildWidgetEmbedSnippet(widget.widget_public_key),
    needsRedeploy: getWidgetNeedsRedeploy(widget, widgetAgents),
  };
}

export function buildStoredWidgetRuntimeAgents(
  widgetAgents: WidgetAgentWithAgent[],
): RuntimeWidgetAgentSelection[] {
  return widgetAgents.map(({ widgetAgent, agent }) => ({
    widgetAgentId: widgetAgent.id,
    persistedWidgetAgentId: widgetAgent.id,
    publishedVersionId: widgetAgent.published_version_id,
    agent,
  }));
}

export async function buildDraftWidgetRuntimeAgents(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  draft: WidgetDraftPreviewInput,
) {
  const orderedDraftAgents = [...draft.agents].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const referencedAgents = await loadWidgetAgentsByIds(
    supabase,
    widget.workspace_id,
    orderedDraftAgents.map((agent) => agent.agentId),
  );
  const agentMap = new Map(referencedAgents.map((agent) => [agent.id, agent]));

  return orderedDraftAgents
    .map((agent, index) => {
      const loadedAgent = agentMap.get(agent.agentId);
      if (!loadedAgent) {
        return null;
      }

      return {
        widgetAgentId: buildDraftPreviewWidgetAgentId(agent.agentId, index),
        persistedWidgetAgentId: null,
        publishedVersionId: loadedAgent.published_version_id,
        agent: loadedAgent,
      } satisfies RuntimeWidgetAgentSelection;
    })
    .filter(Boolean) as RuntimeWidgetAgentSelection[];
}