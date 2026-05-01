import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listToolkitChatActions } from "@/lib/composio";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  getRecommendedChatToolsForToolkit,
  getSupportedIntegration,
  isChatIntegrationSlug,
} from "@/lib/integrations";
import { createClientSafeError } from "@/lib/server-errors";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ toolkitSlug: string }> },
) {
  const { toolkitSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isChatIntegrationSlug(toolkitSlug)) {
    return NextResponse.json(
      { error: "Unsupported chat toolkit." },
      { status: 400 },
    );
  }

  const integration = getSupportedIntegration(toolkitSlug);

  if (!integration) {
    return NextResponse.json(
      { error: "Unsupported integration." },
      { status: 400 },
    );
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const composioUserId = buildWorkspaceComposioUserId(context.workspace.id);
    const actions = await listToolkitChatActions(composioUserId, toolkitSlug);

    return NextResponse.json({
      toolkit: {
        slug: integration.slug,
        displayName: integration.displayName,
      },
      recommendedTools: getRecommendedChatToolsForToolkit(toolkitSlug),
      actions,
    });
  } catch (error) {
    const safeError = createClientSafeError(
      "connections toolkit tools",
      error,
      "Failed to load toolkit actions.",
    );
    return NextResponse.json(safeError, { status: 500 });
  }
}

