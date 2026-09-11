import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import {
  buildWidgetPreviewPayload,
  buildWidgetSummary,
  loadWidgetById,
  signWidgetPreviewToken,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

const DEPLOY_WIDGET_SELECT =
  "id, workspace_id, name, slug, status, widget_public_key, brand_name, logo_url, primary_color, secondary_color, background_color, text_color, theme, language, home_title, home_subtitle, hosted_enabled, show_branding, proactive_message, proactive_enabled, privacy_policy_url, allowed_origins, description, created_at, updated_at, deployed_at";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase, user);
  const loaded = await loadWidgetById(supabase as unknown as WidgetAdminSupabase, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  if (loaded.widgetAgents.length === 0) {
    return NextResponse.json(
      { error: "Attach at least one agent before deploying the widget." },
      { status: 400 },
    );
  }

  const unpublishedAgent = loaded.widgetAgents.find(
    ({ agent }) => !agent.published_version_id,
  );

  if (unpublishedAgent) {
    return NextResponse.json(
      {
        error: `${unpublishedAgent.agent.name} must be published before this widget can be deployed.`,
      },
      { status: 400 },
    );
  }

  const { error: widgetAgentsError } = await supabase
    .from("widget_agents")
    .upsert(
      loaded.widgetAgents.map(({ widgetAgent, agent }) => ({
        ...widgetAgent,
        published_version_id: agent.published_version_id,
      })),
      { onConflict: "widget_id,agent_id" },
    );

  if (widgetAgentsError) {
    return NextResponse.json(
      { error: widgetAgentsError.message || "Failed to snapshot widget agents." },
      { status: 500 },
    );
  }

  const deployedAt = new Date().toISOString();
  const { data: updatedWidget, error: widgetError } = await supabase
    .from("widgets")
    .update({
      status: "deployed",
      deployed_at: deployedAt,
    })
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .select(DEPLOY_WIDGET_SELECT)
    .maybeSingle();

  if (widgetError || !updatedWidget) {
    return NextResponse.json(
      { error: widgetError?.message || "Failed to deploy widget." },
      { status: 500 },
    );
  }

  const summary = buildWidgetSummary(updatedWidget, loaded.widgetAgents, {
    preview: true,
  });
  const previewToken = await signWidgetPreviewToken(
    buildWidgetPreviewPayload({
      widgetPublicKey: summary.widget.widget_public_key,
      widgetId: summary.widget.id,
      workspaceId: context.workspace.id,
      userId: user.id,
    }),
  );

  return NextResponse.json({
    ...summary,
    previewToken,
  });
}
