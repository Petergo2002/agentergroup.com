import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionRecord } from "@/lib/types";
import ConnectionsPageClient from "./ConnectionsPageClient";

async function loadConnectionsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);

  const { data: storedConnections, error } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("display_name", { ascending: true });

  if (error) {
    throw error;
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
    }));

  const toolkits = SUPPORTED_INTEGRATIONS.map((toolkit) => {
    const connection =
      connectionRows.find(
        (item) => item.toolkit_slug === toolkit.slug && item.status === "connected",
      ) ?? connectionRows.find((item) => item.toolkit_slug === toolkit.slug);

    return {
      slug: toolkit.slug,
      displayName: toolkit.displayName,
      description: toolkit.connectionPurpose,
      icon: toolkit.icon,
      simpleIcon: toolkit.simpleIcon,
      simpleIconColor: toolkit.simpleIconColor,
      category: toolkit.category,
      surface: toolkit.surface,
      connection: connection ?? null,
      status: connection?.status ?? "disconnected",
    };
  });

  return {
    initialToolkits: toolkits,
    initialConnections: connectionRows,
  };
}

export default async function ConnectionsPage() {
  const { initialToolkits, initialConnections } = await loadConnectionsPageData();

  return (
    <ConnectionsPageClient
      initialToolkits={initialToolkits}
      initialConnections={initialConnections}
    />
  );
}
