import { NextResponse } from "next/server";
import type { AgentRecord } from "@/lib/types";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  listDashboardConversations,
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
      agentsResult,
      widgetsResult,
      widgetIdsResult,
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
      admin
        .from("agents")
        .select("*")
        .eq("workspace_id", context.workspace.id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
      admin
        .from("widgets")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", context.workspace.id),
      admin
        .from("widgets")
        .select("id")
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
      agentsResult.error,
      widgetsResult.error,
      widgetIdsResult.error,
      liveWidgetsResult.error,
      connectedAppsResult.error,
      knowledgeSourcesResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    const agents = ((agentsResult.data ?? []) as AgentRecord[]).filter(
      (agent) =>
        context.workspace.internal_assistants_enabled || agent.surface !== "assistant",
    );
    const widgetIds = ((widgetIdsResult.data ?? []) as Array<{ id: string }>).map(
      (widget) => widget.id,
    );
    let leadsCount = 0;

    if (widgetIds.length > 0) {
      const leadsResult = await admin
        .from("widget_leads")
        .select("id", { count: "exact", head: true })
        .in("widget_id", widgetIds);

      if (leadsResult.error) {
        throw leadsResult.error;
      }

      leadsCount = leadsResult.count ?? 0;
    }

    return NextResponse.json({
      recentConversations: conversationResult.conversations,
      agents,
      workspaceSummary: {
        totalWidgets: widgetsResult.count ?? 0,
        liveWidgets: liveWidgetsResult.count ?? 0,
        connectedApps: connectedAppsResult.count ?? 0,
        knowledgeSources: knowledgeSourcesResult.count ?? 0,
        leads: leadsCount,
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
