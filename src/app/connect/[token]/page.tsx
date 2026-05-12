import {
  hashConnectionAuthLinkToken,
  isConnectionAuthLinkExpired,
} from "@/lib/connection-auth-links";
import { getSupportedIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectionAuthLinkRecord } from "@/lib/types";
import {
  ConnectStatusPanel,
  type PublicConnectionAuthStatus,
} from "../ConnectStatusPanel";

interface WorkspaceLookup {
  name: string;
}

interface SubscriptionLookup {
  integrations_enabled: boolean;
}

async function loadPublicConnectionLink(token: string): Promise<{
  status: PublicConnectionAuthStatus;
  workspaceName?: string;
  integrationName?: string;
}> {
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

  const [{ data: workspace }, { data: subscription }] = await Promise.all([
    adminClient
      .from("workspaces")
      .select("name")
      .eq("id", authLink.workspace_id)
      .maybeSingle(),
    adminClient
      .from("workspace_subscriptions")
      .select("integrations_enabled")
      .eq("workspace_id", authLink.workspace_id)
      .maybeSingle(),
  ]);

  const base = {
    workspaceName: (workspace as WorkspaceLookup | null)?.name ?? "Workspace",
    integrationName: toolkit.displayName,
  };

  if (!(subscription as SubscriptionLookup | null)?.integrations_enabled) {
    return { ...base, status: "disabled" };
  }

  if (authLink.status === "completed") {
    return { ...base, status: "completed" };
  }

  if (authLink.status === "revoked") {
    return { ...base, status: "revoked" };
  }

  if (isConnectionAuthLinkExpired(authLink.expires_at)) {
    return { ...base, status: "expired" };
  }

  return { ...base, status: "ready" };
}

export default async function PublicConnectionAuthPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const linkState = await loadPublicConnectionLink(token);

  return (
    <ConnectStatusPanel
      token={token}
      status={linkState.status}
      workspaceName={linkState.workspaceName}
      integrationName={linkState.integrationName}
    />
  );
}
