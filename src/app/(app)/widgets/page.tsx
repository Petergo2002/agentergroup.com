import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { buildWidgetSummary, loadAllWidgetsWithAgents } from "@/lib/widgets/server";
import WidgetsPageClient from "./WidgetsPageClient";

async function loadWidgetsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const allWidgets = await loadAllWidgetsWithAgents(supabase as never, context.workspace.id);

  return allWidgets.map((loaded) => {
    const summary = buildWidgetSummary(loaded.widget, loaded.widgetAgents);
    return {
      id: summary.widget.id,
      name: summary.widget.name,
      status: summary.widget.status,
      attachedAgentCount: summary.attachedAgents.length,
      needsRedeploy: summary.needsRedeploy,
      updatedAt: summary.widget.updated_at,
    };
  });
}

export default async function WidgetsPage() {
  const initialWidgets = await loadWidgetsPageData();
  return <WidgetsPageClient initialWidgets={initialWidgets} />;
}
