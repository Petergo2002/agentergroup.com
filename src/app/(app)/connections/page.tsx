import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { getEffectiveConnectionStatus, sortConnectedItemsFirst } from "@/lib/connections";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceAdminRole } from "@/lib/workspace-security";
import type { ConnectionAuthLinkRecord, ConnectionRecord } from "@/lib/types";
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

  if (!context.subscription?.integrations_enabled) {
    const { redirect } = await import("next/navigation");
    redirect("/settings/billing");
  }

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

  const toolkits = sortConnectedItemsFirst(SUPPORTED_INTEGRATIONS.map((toolkit) => {
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
  }));

  let authLinks: Array<Omit<ConnectionAuthLinkRecord, "token_hash">> = [];
  const canManageAuthLinks = isWorkspaceAdminRole(context.membership.role);

  if (canManageAuthLinks) {
    const { data: storedAuthLinks, error: authLinksError } = await supabase
      .from("connection_auth_links")
      .select(
        "id, workspace_id, toolkit_slug, created_by, status, expires_at, completed_connection_id, created_at, updated_at",
      )
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (authLinksError) {
      throw authLinksError;
    }

    authLinks = (storedAuthLinks ?? []) as Array<Omit<ConnectionAuthLinkRecord, "token_hash">>;
  }

  return {
    initialToolkits: toolkits,
    initialConnections: connectionRows,
    initialAuthLinks: authLinks,
    canManageAuthLinks,
  };
}

export default async function ConnectionsPage() {
  const {
    initialToolkits,
    initialConnections,
    initialAuthLinks,
    canManageAuthLinks,
  } = await loadConnectionsPageData();

  return (
    <ConnectionsPageClient
      initialToolkits={initialToolkits}
      initialConnections={initialConnections}
      initialAuthLinks={initialAuthLinks}
      canManageAuthLinks={canManageAuthLinks}
    />
  );
}
