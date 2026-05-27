import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { getWidgetNeedsRedeploy, loadAllWidgetsWithAgents } from "@/lib/widgets/server";
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
    return {
      id: loaded.widget.id,
      name: loaded.widget.name,
      description: loaded.widget.description,
      status: loaded.widget.status,
      attachedAgentCount: loaded.widgetAgents.length,
      needsRedeploy: getWidgetNeedsRedeploy(loaded.widget, loaded.widgetAgents),
      updatedAt: loaded.widget.updated_at,
    };
  });
}

export default async function WidgetsPage() {
  const initialWidgets = await loadWidgetsPageData();
  return <WidgetsPageClient initialWidgets={initialWidgets} />;
}
