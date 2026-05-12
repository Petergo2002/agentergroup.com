import {
  hashConnectionAuthLinkToken,
  isConnectionAuthLinkExpired,
} from "@/lib/connection-auth-links";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { syncConnectedAccountsToDatabase } from "@/lib/composio";
import { getSupportedIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectionAuthLinkRecord, ConnectionRecord } from "@/lib/types";
import {
  ConnectStatusPanel,
  type PublicConnectionAuthStatus,
} from "../ConnectStatusPanel";

interface WorkspaceLookup {
  name: string;
}

async function resolveCallbackState(token: string): Promise<{
  status: PublicConnectionAuthStatus;
  workspaceName?: string;
  integrationName?: string;
}> {
  if (!token) {
    return { status: "invalid" };
  }

  const adminClient = createAdminClient();
  const { data: linkRow } = await adminClient
    .from("connection_auth_links")
    .select("*")
    .eq("token_hash", hashConnectionAuthLinkToken(token))
    .maybeSingle();

  const authLink = linkRow as ConnectionAuthLinkRecord | null;

  if (!authLink) {
    return { status: "invalid" };
  }

  const toolkit = getSupportedIntegration(authLink.toolkit_slug);

  if (!toolkit) {
    return { status: "unsupported" };
  }

  const { data: workspace } = await adminClient
    .from("workspaces")
    .select("name")
    .eq("id", authLink.workspace_id)
    .maybeSingle();

  const base = {
    workspaceName: (workspace as WorkspaceLookup | null)?.name ?? "Workspace",
    integrationName: toolkit.displayName,
  };

  if (authLink.status === "completed") {
    return { ...base, status: "completed" };
  }

  if (authLink.status === "revoked") {
    return { ...base, status: "revoked" };
  }

  try {
    await syncConnectedAccountsToDatabase(
      adminClient as never,
      authLink.workspace_id,
      authLink.created_by,
    );
  } catch (error) {
    console.error("[connect/callback] Failed to sync connected accounts:", error);
    return { ...base, status: "error" };
  }

  const { data: connectionRow } = await adminClient
    .from("connections")
    .select("*")
    .eq("workspace_id", authLink.workspace_id)
    .eq("toolkit_slug", toolkit.slug)
    .maybeSingle();

  const connection = connectionRow as ConnectionRecord | null;
  const isConnected =
    connection && getEffectiveConnectionStatus(connection) === "connected";

  if (isConnected) {
    await adminClient
      .from("connection_auth_links")
      .update({
        status: "completed",
        completed_connection_id: connection.id,
      })
      .eq("id", authLink.id);

    return { ...base, status: "completed" };
  }

  if (isConnectionAuthLinkExpired(authLink.expires_at)) {
    return { ...base, status: "expired" };
  }

  return { ...base, status: "pending" };
}

export default async function PublicConnectionAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const linkState = await resolveCallbackState(token);

  return (
    <ConnectStatusPanel
      status={linkState.status}
      workspaceName={linkState.workspaceName}
      integrationName={linkState.integrationName}
    />
  );
}
