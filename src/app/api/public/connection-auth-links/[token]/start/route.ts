import { NextResponse } from "next/server";
import {
  hashConnectionAuthLinkToken,
  isConnectionAuthLinkExpired,
} from "@/lib/connection-auth-links";
import { createConnectionRequest } from "@/lib/composio";
import { getAppUrl } from "@/lib/env";
import { getSupportedIntegration } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectionAuthLinkRecord } from "@/lib/types";

interface WorkspaceSubscriptionLookup {
  integrations_enabled: boolean;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  const token = String(rawToken ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Connection link token is required." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: linkRow, error: linkError } = await adminClient
    .from("connection_auth_links")
    .select("*")
    .eq("token_hash", hashConnectionAuthLinkToken(token))
    .maybeSingle();

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const authLink = linkRow as ConnectionAuthLinkRecord | null;

  if (!authLink) {
    return NextResponse.json(
      { error: "Connection link not found." },
      { status: 404 },
    );
  }

  if (authLink.status !== "pending") {
    return NextResponse.json(
      { error: "This connection link is no longer active." },
      { status: 409 },
    );
  }

  if (isConnectionAuthLinkExpired(authLink.expires_at)) {
    return NextResponse.json(
      { error: "This connection link has expired." },
      { status: 410 },
    );
  }

  const toolkit = getSupportedIntegration(authLink.toolkit_slug);

  if (!toolkit) {
    return NextResponse.json({ error: "Unsupported integration." }, { status: 400 });
  }

  const { data: subscription, error: subscriptionError } = await adminClient
    .from("workspace_subscriptions")
    .select("integrations_enabled")
    .eq("workspace_id", authLink.workspace_id)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  if (!(subscription as WorkspaceSubscriptionLookup | null)?.integrations_enabled) {
    return NextResponse.json(
      { error: "Integration access is disabled for this workspace." },
      { status: 403 },
    );
  }

  try {
    const callbackUrl = `${getAppUrl()}/connect/callback?token=${encodeURIComponent(token)}`;
    const connectionRequest = await createConnectionRequest(
      authLink.workspace_id,
      authLink.created_by,
      toolkit.slug,
      { callbackUrl },
    );

    const { error: upsertError } = await adminClient.from("connections").upsert(
      {
        workspace_id: authLink.workspace_id,
        provider: "composio",
        toolkit_slug: toolkit.slug,
        display_name: toolkit.displayName,
        status: "pending",
        external_id: connectionRequest.id,
        account_label: "default",
        toolkit_data: connectionRequest.session
          ? {
              authConfigId: connectionRequest.authConfigId,
              composioUserId: connectionRequest.composioUserId,
              connectionAuthLinkId: authLink.id,
              toolRouterSessionId: connectionRequest.session.sessionId,
              toolRouterSessionUrl: connectionRequest.session.mcp.url,
            }
          : {
              authConfigId: connectionRequest.authConfigId,
              composioUserId: connectionRequest.composioUserId,
              connectionAuthLinkId: authLink.id,
            },
        created_by: authLink.created_by,
      },
      {
        onConflict: "workspace_id,toolkit_slug",
      },
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
    });
  } catch (error) {
    console.error("[connection-auth-links/start] Failed to start auth flow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start connection flow.",
      },
      { status: 500 },
    );
  }
}
