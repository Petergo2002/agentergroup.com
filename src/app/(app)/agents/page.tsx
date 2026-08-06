import type { AgentRecord } from "@/lib/types";
import { getAppRequestContext } from "@/lib/app/request-context";
import { DASHBOARD_AGENT_SELECT } from "@/lib/dashboard/summary";
import { WORKSPACE_AGENT_LIST_LIMIT } from "@/lib/query-limits";
import AgentsPageClient from "./AgentsPageClient";

async function loadAgentsPageData() {
  const { supabase, user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("agents")
    .select(DASHBOARD_AGENT_SELECT)
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false })
    .limit(WORKSPACE_AGENT_LIST_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AgentRecord[]).filter(
    (agent) =>
      (context.workspace.internal_assistants_enabled || agent.surface !== "assistant") &&
      (context.workspace.automations_enabled || agent.surface !== "automation"),
  );
}

export default async function AgentsPage() {
  const initialAgents = await loadAgentsPageData();
  return <AgentsPageClient initialAgents={initialAgents} />;
}
