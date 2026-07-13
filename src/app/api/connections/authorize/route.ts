import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createConnectionRequest } from "@/lib/composio";
import { getSupportedIntegration } from "@/lib/integrations";
import { createClientSafeError } from "@/lib/server-errors";
import { z } from "zod";

const authorizeConnectionSchema = z
  .object({
    toolkitSlug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/i),
  })
  .strict();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = authorizeConnectionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "A valid toolkitSlug is required." },
      { status: 400 },
    );
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const toolkitSlug = parsedBody.data.toolkitSlug.toLowerCase();

  if (!context.subscription?.integrations_enabled) {
    return NextResponse.json(
      { error: "Connections are available on workspaces with integrations enabled." },
      { status: 403 },
    );
  }

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
        onConflict: "workspace_id,toolkit_slug",
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
