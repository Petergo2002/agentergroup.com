import type { ConnectionRecord, KnowledgeFolderWithSources, KnowledgeSourceRecord } from "@/lib/types";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import {
  toKnowledgeFolderWithSources,
  type KnowledgeFolderJoinRow,
} from "@/lib/knowledge-folders";
import { createClient } from "@/lib/supabase/server";
import KnowledgePageClient from "./KnowledgePageClient";

async function loadKnowledgePageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);

  const [
    { data: sourcesData, error: sourcesError },
    { data: foldersData, error: foldersError },
    { data: storedConnections, error: connectionsError },
  ] =
    await Promise.all([
      supabase
        .from("knowledge_sources")
        .select("*")
        .eq("workspace_id", context.workspace.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("knowledge_folders")
        .select("*, sources:knowledge_folder_sources(knowledge_source_id)")
        .eq("workspace_id", context.workspace.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("connections")
        .select("*")
        .eq("workspace_id", context.workspace.id)
        .order("display_name", { ascending: true }),
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
