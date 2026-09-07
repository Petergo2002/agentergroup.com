import { getAppRequestContext } from "@/lib/app/request-context";
import { getWidgetNeedsRedeploy, loadAllWidgetsWithAgents } from "@/lib/widgets/server";
import WidgetsPageClient from "./WidgetsPageClient";
import { redirect } from "next/navigation";
import { isMiloExperienceEnabled } from "@/lib/env";
import { isMiloMode } from "@/lib/milo/experience";

async function loadWidgetsPageData() {
  const { supabase, user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

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
  const { context } = await getAppRequestContext();
  if (context && isMiloMode(context.workspace, isMiloExperienceEnabled())) redirect("/website-chat");
  const initialWidgets = await loadWidgetsPageData();
  return <WidgetsPageClient initialWidgets={initialWidgets} />;
}
