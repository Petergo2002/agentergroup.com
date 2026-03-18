import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export interface DashboardData {
  overview: {
    conversations: number;
    messages: number;
    leads: number;
    failures: number;
  };
  conversations: Array<{
    id: string;
    widgetName: string;
    agentName: string;
    messageCount: number;
    lastMessageAt: string;
    status: string;
  }>;
  widgetOptions: Array<{ id: string; name: string }>;
  agentOptions: Array<{ id: string; name: string }>;
}

export async function fetchDashboardAnalytics(
  userId: string,
  range: string = "30d",
  limit: number = 25,
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const validRange = range === "7d" || range === "90d" ? range : "30d";
  const now = new Date();
  let startDate: Date;

  switch (validRange) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const startIso = startDate.toISOString();

  const { data: conversations, error: convError } = await admin
    .from("widget_sessions")
    .select(`
      id,
      created_at,
      status,
      widget_id,
      widget:widgets!inner(name),
      widget_agents!inner(agent_id, agent:agents!inner(name))
    `)
    .eq("workspace_id", context.workspace.id)
    .gte("created_at", startIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (convError) {
    throw new Error(convError.message);
  }

  const { data: allWidgets } = await admin
    .from("widgets")
    .select("id, name")
    .eq("workspace_id", context.workspace.id);

  const { data: allAgents } = await admin
    .from("agents")
    .select("id, name")
    .eq("workspace_id", context.workspace.id);

  const widgetMap = new Map((allWidgets ?? []).map((w) => [w.id, w.name]));
  const agentMap = new Map((allAgents ?? []).map((a) => [a.id, a.name]));

  const formattedConversations = (conversations ?? []).map((conv: Record<string, unknown>) => {
    const widget = conv.widget as { name: string } | null;
    const widgetAgents = conv.widget_agents as Array<{ agent: { name: string } }> | null;
    return {
      id: conv.id as string,
      widgetName: widget?.name || "Unknown Widget",
      agentName: widgetAgents?.[0]?.agent?.name || "Unknown Agent",
      messageCount: 0,
      lastMessageAt: conv.created_at as string,
      status: conv.status as string,
    };
  });

  const overview = {
    conversations: (conversations ?? []).length,
    messages: 0,
    leads: 0,
    failures: (conversations ?? []).filter((c: Record<string, unknown>) => c.status === "failed").length,
  };

  return {
    overview,
    conversations: formattedConversations,
    widgetOptions: (allWidgets ?? []).map((w) => ({ id: w.id, name: w.name })),
    agentOptions: (allAgents ?? []).map((a) => ({ id: a.id, name: a.name })),
  };
}

export async function fetchWorkspaceSummary(workspaceId: string) {
  const admin = createAdminClient();

  const [widgetsResult, liveWidgetsResult, connectionsResult, knowledgeResult] = await Promise.all([
    admin.from("widgets").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("widgets").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "deployed"),
    admin.from("connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "connected"),
    admin.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  return {
    totalWidgets: widgetsResult.count ?? 0,
    liveWidgets: liveWidgetsResult.count ?? 0,
    connectedApps: connectionsResult.count ?? 0,
    knowledgeSources: knowledgeResult.count ?? 0,
  };
}

export async function fetchAgents(workspaceId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
