import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createConnectionRequest } from "@/lib/composio";
import { getSupportedIntegration } from "@/lib/integrations";
import { createClientSafeError } from "@/lib/server-errors";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolkitSlug } = await request.json();

  if (!toolkitSlug) {
    return NextResponse.json({ error: "toolkitSlug is required." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const toolkit = getSupportedIntegration(toolkitSlug);

  if (!toolkit) {
    return NextResponse.json({ error: "Unsupported integration." }, { status: 400 });
  }

  try {
    const connectionRequest = await createConnectionRequest(
      context.workspace.id,
      user.id,
      toolkitSlug,
    );

    await supabase.from("connections").upsert(
      {
        workspace_id: context.workspace.id,
        provider: "composio",
        toolkit_slug: toolkitSlug,
        display_name: toolkit?.displayName ?? toolkitSlug,
        status: "pending",
        external_id: connectionRequest.id,
        account_label: "default",
        toolkit_data: connectionRequest.session
          ? {
            authConfigId: connectionRequest.authConfigId,
            composioUserId: connectionRequest.composioUserId,
              toolRouterSessionId: connectionRequest.session.sessionId,
              toolRouterSessionUrl: connectionRequest.session.mcp.url,
            }
          : {
              authConfigId: connectionRequest.authConfigId,
              composioUserId: connectionRequest.composioUserId,
            },
        created_by: user.id,
      },
      {
        onConflict: "workspace_id,toolkit_slug,account_label",
      },
    );

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
    });
  } catch (error) {
    const safeError = createClientSafeError(
      "connections authorize",
      error,
      "Failed to start connection flow.",
    );
    return NextResponse.json(
      safeError,
      { status: 500 },
    );
  }
}
