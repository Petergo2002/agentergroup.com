import type { AgentRecord } from "@/lib/types";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import AgentsPageClient from "./AgentsPageClient";

async function loadAgentsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AgentRecord[]).filter(
    (agent) =>
      context.workspace.internal_assistants_enabled || agent.surface !== "assistant",
  );
}

export default async function AgentsPage() {
  const initialAgents = await loadAgentsPageData();
  return <AgentsPageClient initialAgents={initialAgents} />;
}
