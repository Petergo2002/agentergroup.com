import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getEffectiveConnectionStatus, sortConnectedItemsFirst } from "@/lib/connections";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import type { ConnectionRecord } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);

  const { data: storedConnections } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("display_name", { ascending: true });

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

  const merged = sortConnectedItemsFirst(SUPPORTED_INTEGRATIONS.map((toolkit) => {
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

  return NextResponse.json({
    toolkits: merged,
    connections: connectionRows,
  });
}
