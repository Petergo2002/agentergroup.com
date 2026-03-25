import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export interface WidgetListItem {
  id: string;
  name: string;
  status: "draft" | "deployed";
  widgetPublicKey: string;
  attachedAgentCount: number;
  hostedUrl: string;
  needsRedeploy: boolean;
  updatedAt: string;
}

export async function fetchWidgets(userId: string): Promise<WidgetListItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const admin = createAdminClient();

  const { data: widgets, error } = await admin
    .from("widgets")
    .select(`
      id,
      name,
      status,
      widget_public_key,
      hosted_url,
      needs_redeploy,
      updated_at,
      widget_agents(id)
    `)
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (widgets ?? []).map((widget) => ({
    id: widget.id,
    name: widget.name,
    status: widget.status as "draft" | "deployed",
    widgetPublicKey: widget.widget_public_key,
    attachedAgentCount: (widget.widget_agents ?? []).length,
    hostedUrl: widget.hosted_url || "",
    needsRedeploy: widget.needs_redeploy ?? false,
    updatedAt: widget.updated_at,
  }));
}
