import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listRecentDashboardConversations } from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AgentRecord,
  AppWorkspaceContext,
  DashboardSummaryResponse,
} from "@/lib/types";

type SupabaseLike = Pick<SupabaseClient, "from">;

export const DASHBOARD_AGENT_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";

export async function loadDashboardSummary(
  supabase: SupabaseLike,
  user: User,
): Promise<DashboardSummaryResponse> {
  const context = await ensureWorkspaceContext(supabase as never, user);

  return loadDashboardSummaryForContext(context);
}

export async function loadDashboardSummaryForContext(
  context: AppWorkspaceContext,
): Promise<DashboardSummaryResponse> {
  const admin = createAdminClient();

  // 1. Fetch agents and widgets first in parallel
  const [agentsResult, widgetsResult] = await Promise.all([
    admin
      .from("agents")
      .select(DASHBOARD_AGENT_SELECT)
      .eq("workspace_id", context.workspace.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    admin
      .from("widgets")
      .select("id, name, status, widget_public_key")
      .eq("workspace_id", context.workspace.id),
  ]);

  if (agentsResult.error) {
    throw agentsResult.error;
  }
  if (widgetsResult.error) {
    throw widgetsResult.error;
  }

  const rawAgents = (agentsResult.data ?? []) as AgentRecord[];
  const rawWidgets = (widgetsResult.data ?? []) as Array<{
    id: string;
    name: string;
    status: "draft" | "deployed";
    widget_public_key: string;
  }>;
  const widgetIds = rawWidgets.map((widget) => widget.id);

  // 2. Fetch conversations and all counts in parallel without duplicate widget/agent queries
  const [
    recentConversations,
    connectedAppsResult,
    knowledgeSourcesResult,
    unansweredQuestionsResult,
    leadsResult,
  ] = await Promise.all([
    listRecentDashboardConversations(admin, {
      workspaceId: context.workspace.id,
      range: "30d",
      limit: 4,
      widgets: rawWidgets,
      agents: rawAgents,
    }),
    admin
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id)
      .eq("status", "connected"),
    admin
      .from("knowledge_sources")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id),
    admin
      .from("unanswered_queries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspace.id)
      .eq("status", "open"),
    widgetIds.length > 0
      ? admin
          .from("widget_leads")
          .select("id", { count: "exact", head: true })
          .in("widget_id", widgetIds)
      : Promise.resolve({ data: null, count: 0, error: null }),
  ]);

  const errors = [
    connectedAppsResult.error,
    knowledgeSourcesResult.error,
    unansweredQuestionsResult.error,
    leadsResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  const agents = rawAgents.filter(
    (agent) =>
      (context.workspace.internal_assistants_enabled || agent.surface !== "assistant") &&
      (context.workspace.automations_enabled || agent.surface !== "automation"),
  );

  return {
    recentConversations,
    agents,
    workspaceSummary: {
      totalWidgets: rawWidgets.length,
      liveWidgets: rawWidgets.filter((widget) => widget.status === "deployed").length,
      connectedApps: connectedAppsResult.count ?? 0,
      knowledgeSources: knowledgeSourcesResult.count ?? 0,
      leads: leadsResult.count ?? 0,
      unansweredQuestions: unansweredQuestionsResult.count ?? 0,
    },
  };
}
