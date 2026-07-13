import type { User } from "@supabase/supabase-js";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { isChatIntegrationSlug } from "@/lib/integrations";
import { toKnowledgeFolderWithSources, type KnowledgeFolderJoinRow } from "@/lib/knowledge-folders";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentAutomationRecord,
  AgentRecord,
  AgentVersionRecord,
  AutomationEventRecord,
  BuilderDefinition,
  ConnectionRecord,
  KnowledgeFolderWithSources,
  KnowledgeSourceRecord,
  RunRecord,
} from "@/lib/types";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

interface AgentDraftRecord {
  id: string;
  agent_id: string;
  workspace_id: string;
  definition: BuilderDefinition;
  version: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderBootstrapResponse {
  agent: AgentRecord;
  draft: AgentDraftRecord | null;
  versions: AgentVersionRecord[];
  connections: ConnectionRecord[];
  selectedConnectionIds: string[];
  knowledgeSources: KnowledgeSourceRecord[];
  attachedKnowledgeSources: KnowledgeSourceRecord[];
  attachedKnowledgeFolders: KnowledgeFolderWithSources[];
  availableKnowledgeFolders: KnowledgeFolderWithSources[];
  automation: {
    automation: AgentAutomationRecord | null;
    events: AutomationEventRecord[];
    runs: RunRecord[];
    environment: {
      hasComposio: boolean;
      hasWebhookSecret: boolean;
    } | null;
  };
  currentUserId: string;
}

export const BUILDER_AGENT_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";
export const BUILDER_KNOWLEDGE_SOURCE_SELECT =
  "id, workspace_id, created_by, name, description, source_type, status, storage_bucket, storage_path, mime_type, file_size_bytes, chunk_count, last_processed_at, error_message, metadata, created_at, updated_at";

const BUILDER_DRAFT_SELECT =
  "id, agent_id, workspace_id, definition, version, updated_by, created_at, updated_at";
const BUILDER_VERSION_SELECT =
  "id, agent_id, workspace_id, version, definition, published_by, created_at";
const CONNECTION_SELECT =
  "id, workspace_id, provider, toolkit_slug, display_name, status, external_id, account_label, toolkit_data, created_by, last_synced_at, created_at, updated_at";
const AUTOMATION_RECORD_SELECT =
  "id, workspace_id, agent_id, connection_id, provider, toolkit_slug, trigger_slug, trigger_config, composio_trigger_id, status, last_event_at, last_error, created_at, updated_at";
const RUN_SELECT =
  "id, workspace_id, agent_id, thread_id, status, model, input, output, error_message, started_at, completed_at, created_at";
const AUTOMATION_EVENT_SELECT =
  "id, workspace_id, agent_id, automation_id, run_id, external_event_id, trigger_slug, payload, status, created_at, updated_at";
const KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT =
  "id, workspace_id, created_by, name, description, metadata, created_at, updated_at, sources:knowledge_folder_sources(knowledge_source_id)";

interface AgentKnowledgeJoinRow {
  source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
}

interface AgentKnowledgeFolderJoinRow {
  folder: KnowledgeFolderJoinRow | KnowledgeFolderJoinRow[] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasComposioTrigger(definition: BuilderDefinition | null | undefined) {
  if (!definition || !Array.isArray(definition.nodes)) {
    return false;
  }

  return definition.nodes.some(
    (node) =>
      isRecord(node) &&
      isRecord(node.data) &&
      node.data.kind === "trigger" &&
      node.data.provider === "composio",
  );
}

export async function loadAgentBuilderBootstrap(
  supabase: ServerSupabase,
  user: User,
  agentId: string,
): Promise<AgentBuilderBootstrapResponse> {
  const context = await ensureWorkspaceContext(supabase as never, user);

  await syncConnectedAccountsToDatabase(
    supabase as never,
    context.workspace.id,
    user.id,
  );

  const [
    agentResult,
    draftResult,
    versionsResult,
    connectionsResult,
    selectedConnectionsResult,
    knowledgeSourcesResult,
    attachedSourcesResult,
    attachedFoldersResult,
    availableFoldersResult,
    automationResult,
    runsResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from("agents")
      .select(BUILDER_AGENT_SELECT)
      .eq("id", agentId)
      .eq("workspace_id", context.workspace.id)
      .single(),
    supabase
      .from("agent_drafts")
      .select(BUILDER_DRAFT_SELECT)
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("agent_versions")
      .select(BUILDER_VERSION_SELECT)
      .eq("agent_id", agentId)
      .order("version", { ascending: false }),
    supabase
      .from("connections")
      .select(CONNECTION_SELECT)
      .eq("workspace_id", context.workspace.id)
      .order("display_name", { ascending: true }),
    supabase.from("agent_connections").select("connection_id").eq("agent_id", agentId),
    supabase
      .from("knowledge_sources")
      .select(BUILDER_KNOWLEDGE_SOURCE_SELECT)
      .eq("workspace_id", context.workspace.id)
      .is("widget_session_id", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("agent_knowledge_sources")
      .select(`source:knowledge_sources(${BUILDER_KNOWLEDGE_SOURCE_SELECT})`)
      .eq("agent_id", agentId),
    supabase
      .from("agent_knowledge_folders")
      .select(`folder:knowledge_folders(${KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT})`)
      .eq("agent_id", agentId),
    supabase
      .from("knowledge_folders")
      .select(KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT)
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("agent_automations")
      .select(AUTOMATION_RECORD_SELECT)
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("runs")
      .select(RUN_SELECT)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("automation_events")
      .select(AUTOMATION_EVENT_SELECT)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (agentResult.error || !agentResult.data) {
    throw new Error(agentResult.error?.message ?? "Agent not found.");
  }
  if (draftResult.error) throw new Error(draftResult.error.message);
  if (versionsResult.error) throw new Error(versionsResult.error.message);
  if (connectionsResult.error) throw new Error(connectionsResult.error.message);
  if (selectedConnectionsResult.error) throw new Error(selectedConnectionsResult.error.message);
  if (knowledgeSourcesResult.error) throw new Error(knowledgeSourcesResult.error.message);
  if (attachedSourcesResult.error) throw new Error(attachedSourcesResult.error.message);
  if (attachedFoldersResult.error) throw new Error(attachedFoldersResult.error.message);
  if (availableFoldersResult.error) throw new Error(availableFoldersResult.error.message);
  if (automationResult.error) throw new Error(automationResult.error.message);
  if (runsResult.error) throw new Error(runsResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);

  const connections = ((connectionsResult.data ?? []) as ConnectionRecord[])
    .map((connection) => ({
      ...connection,
      status: getEffectiveConnectionStatus(connection),
    }))
    .filter((connection) => isChatIntegrationSlug(connection.toolkit_slug));
  const attachedKnowledgeSources = (
    (attachedSourcesResult.data ?? []) as unknown as AgentKnowledgeJoinRow[]
  )
    .map((item) => (Array.isArray(item.source) ? item.source[0] ?? null : item.source))
    .filter(Boolean) as KnowledgeSourceRecord[];
  const attachedKnowledgeFolders = (
    (attachedFoldersResult.data ?? []) as unknown as AgentKnowledgeFolderJoinRow[]
  )
    .map((item) => (Array.isArray(item.folder) ? item.folder[0] ?? null : item.folder))
    .filter(Boolean)
    .map((folder) => toKnowledgeFolderWithSources(folder as KnowledgeFolderJoinRow));
  const availableKnowledgeFolders = (
    (availableFoldersResult.data ?? []) as unknown as KnowledgeFolderJoinRow[]
  ).map((folder) => toKnowledgeFolderWithSources(folder));

  const draftDefinition = (draftResult.data?.definition ?? null) as BuilderDefinition | null;
  const automation = (automationResult.data ?? null) as AgentAutomationRecord | null;

  return {
    agent: agentResult.data as AgentRecord,
    draft: (draftResult.data ?? null) as AgentDraftRecord | null,
    versions: (versionsResult.data ?? []) as AgentVersionRecord[],
    connections,
    selectedConnectionIds: ((selectedConnectionsResult.data ?? []) as Array<{ connection_id: string }>).map(
      (item) => item.connection_id,
    ),
    knowledgeSources: (knowledgeSourcesResult.data ?? []) as KnowledgeSourceRecord[],
    attachedKnowledgeSources,
    attachedKnowledgeFolders,
    availableKnowledgeFolders,
    automation: {
      automation,
      events: (eventsResult.data ?? []) as AutomationEventRecord[],
      runs: (runsResult.data ?? []) as RunRecord[],
      environment:
        agentResult.data.surface === "automation" ||
        Boolean(automationResult.data) ||
        hasComposioTrigger(draftDefinition)
          ? {
              hasComposio: hasComposioEnv(),
              hasWebhookSecret: hasComposioWebhookSecret(),
            }
          : null,
    },
    currentUserId: user.id,
  };
}
