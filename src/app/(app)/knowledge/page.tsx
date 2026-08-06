import type { ConnectionRecord, KnowledgeFolderWithSources, KnowledgeSourceRecord } from "@/lib/types";
import { getAppRequestContext } from "@/lib/app/request-context";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import {
  toKnowledgeFolderWithSources,
  type KnowledgeFolderJoinRow,
} from "@/lib/knowledge-folders";
import {
  WORKSPACE_CONNECTION_LIST_LIMIT,
  WORKSPACE_KNOWLEDGE_FOLDER_LIST_LIMIT,
  WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT,
} from "@/lib/query-limits";
import KnowledgePageClient from "./KnowledgePageClient";

async function loadKnowledgePageData() {
  const { supabase, user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

  const [
    { data: sourcesData, error: sourcesError },
    { data: foldersData, error: foldersError },
    { data: storedConnections, error: connectionsError },
  ] =
    await Promise.all([
      supabase
        .from("knowledge_sources")
        .select(
          "id, workspace_id, created_by, name, description, source_type, status, storage_bucket, storage_path, mime_type, file_size_bytes, chunk_count, last_processed_at, error_message, metadata, created_at, updated_at",
        )
        .eq("workspace_id", context.workspace.id)
        .is("widget_session_id", null)
        .order("updated_at", { ascending: false })
        .limit(WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT),
      supabase
        .from("knowledge_folders")
        .select("*, sources:knowledge_folder_sources(knowledge_source_id)")
        .eq("workspace_id", context.workspace.id)
        .order("updated_at", { ascending: false })
        .limit(WORKSPACE_KNOWLEDGE_FOLDER_LIST_LIMIT),
      supabase
        .from("connections")
        .select(
          "id, workspace_id, provider, toolkit_slug, display_name, status, external_id, account_label, toolkit_data, created_by, last_synced_at, created_at, updated_at",
        )
        .eq("workspace_id", context.workspace.id)
        .order("display_name", { ascending: true })
        .limit(WORKSPACE_CONNECTION_LIST_LIMIT),
    ]);

  if (sourcesError) {
    throw sourcesError;
  }

  if (foldersError) {
    throw foldersError;
  }

  if (connectionsError) {
    throw connectionsError;
  }

  const connectionRows = ((storedConnections ?? []) as ConnectionRecord[])
    .filter((connection) =>
      SUPPORTED_INTEGRATIONS.some(
        (integration) => integration.slug === connection.toolkit_slug,
      ),
    )
    .map((connection) => ({
      ...connection,
      status: getEffectiveConnectionStatus(connection),
    }))
    .filter(
      (connection) =>
        connection.toolkit_slug === "googledrive" && connection.status === "connected",
    );

  return {
    initialSources: (sourcesData ?? []) as KnowledgeSourceRecord[],
    initialFolders: ((foldersData ?? []) as unknown as KnowledgeFolderJoinRow[]).map(
      toKnowledgeFolderWithSources,
    ) as KnowledgeFolderWithSources[],
    initialDriveConnections: connectionRows,
    subscription: context.subscription,
  };
}

export default async function KnowledgePage() {
  const { initialSources, initialFolders, initialDriveConnections, subscription } =
    await loadKnowledgePageData();
  return (
    <KnowledgePageClient
      initialSources={initialSources}
      initialFolders={initialFolders}
      initialDriveConnections={initialDriveConnections}
      subscription={subscription}
    />
  );
}
