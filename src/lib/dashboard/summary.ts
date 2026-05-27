import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listRecentDashboardConversations } from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentRecord, DashboardSummaryResponse } from "@/lib/types";

type SupabaseLike = Pick<SupabaseClient, "from">;

export const DASHBOARD_AGENT_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";

export async function loadDashboardSummary(
  supabase: SupabaseLike,
  user: User,
): Promise<DashboardSummaryResponse> {
  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  const [
    recentConversations,
    agentsResult,
    widgetsResult,
    connectedAppsResult,
    knowledgeSourcesResult,
  ] = await Promise.all([
    listRecentDashboardConversations(admin, {
      workspaceId: context.workspace.id,
      range: "30d",
      limit: 4,
    }),
    admin
      .from("agents")
      .select(DASHBOARD_AGENT_SELECT)
      .eq("workspace_id", context.workspace.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    admin
      .from("widgets")
      .select("id, status")
      .eq("workspace_id", context.workspace.id),
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
    connectedAppsResult.error,
    knowledgeSourcesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  const agents = ((agentsResult.data ?? []) as AgentRecord[]).filter(
    (agent) =>
      (context.workspace.internal_assistants_enabled || agent.surface !== "assistant") &&
      (context.workspace.automations_enabled || agent.surface !== "automation"),
  );
  const widgets = (widgetsResult.data ?? []) as Array<{
    id: string;
    status: "draft" | "deployed";
  }>;
  const widgetIds = widgets.map((widget) => widget.id);
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

  return {
    recentConversations,
    agents,
    workspaceSummary: {
      totalWidgets: widgets.length,
      liveWidgets: widgets.filter((widget) => widget.status === "deployed").length,
      connectedApps: connectedAppsResult.count ?? 0,
      knowledgeSources: knowledgeSourcesResult.count ?? 0,
      leads: leadsCount,
    },
  };
}
