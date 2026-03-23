import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  listDashboardConversations,
  listWorkspaceAgentsForAnalytics,
} from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const admin = createAdminClient();

    const [
      conversationResult,
      agents,
      widgetsResult,
      liveWidgetsResult,
      connectedAppsResult,
      knowledgeSourcesResult,
    ] = await Promise.all([
      listDashboardConversations(admin, {
        workspaceId: context.workspace.id,
        appliedFilters: {
          range: "30d",
          widgetId: null,
          agentId: null,
          search: "",
        },
        cursor: null,
        limit: 4,
      }),
      listWorkspaceAgentsForAnalytics(admin, context.workspace.id),
      admin
        .from("widgets")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", context.workspace.id),
      admin
        .from("widgets")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", context.workspace.id)
        .eq("status", "deployed"),
      admin
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", context.workspace.id)
        .eq("status", "connected"),
      admin
        .from("knowledge_sources")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", context.workspace.id),
    ]);

    const errors = [
      widgetsResult.error,
      liveWidgetsResult.error,
      connectedAppsResult.error,
      knowledgeSourcesResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    return NextResponse.json({
      recentConversations: conversationResult.conversations,
      agents,
      workspaceSummary: {
        totalWidgets: widgetsResult.count ?? 0,
        liveWidgets: liveWidgetsResult.count ?? 0,
        connectedApps: connectedAppsResult.count ?? 0,
        knowledgeSources: knowledgeSourcesResult.count ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard summary.",
      },
      { status: 500 },
    );
  }
}
