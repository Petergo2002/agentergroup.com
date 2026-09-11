import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";
import { loadWidgetById, type WidgetAdminSupabase } from "@/lib/widgets/server";

export async function POST(
  request: NextRequest,
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
  const loaded = await loadWidgetById(supabase as unknown as WidgetAdminSupabase, id, {
    canHideBranding: context.subscription?.plan_tier === "premium",
  });

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const status =
    body.status === "deployed" ? "deployed" : body.status === "draft" ? "draft" : null;

  if (!status) {
    return NextResponse.json({ error: "Invalid widget status." }, { status: 400 });
  }

  if (status === "deployed") {
    if (loaded.widgetAgents.length === 0) {
      return NextResponse.json(
        { error: "Attach at least one agent before turning the widget on." },
        { status: 400 },
      );
    }

    const unsupportedAgent = loaded.widgetAgents.find(
      ({ agent }) => agent.surface !== "widget",
    );

    if (unsupportedAgent) {
      return NextResponse.json(
        {
          error: `${unsupportedAgent.agent.name} is an internal assistant and cannot be attached to widgets.`,
        },
        { status: 400 },
      );
    }

    const unpublishedAgent = loaded.widgetAgents.find(
      ({ agent }) => !agent.published_version_id,
    );

    if (unpublishedAgent) {
      return NextResponse.json(
        {
          error: `${unpublishedAgent.agent.name} must be published before this widget can be turned on.`,
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
  }

  const nextValues =
    status === "deployed"
      ? { status, deployed_at: new Date().toISOString() }
      : { status, deployed_at: null };

  const { error: updateError } = await supabase
    .from("widgets")
    .update(nextValues)
    .eq("id", id)
    .eq("workspace_id", context.workspace.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update widget status." },
      { status: 500 },
    );
  }

  try {
    await createAuditLog(supabase, {
      workspaceId: context.workspace.id,
      actorId: user.id,
      action: status === "deployed" ? "widget.activated" : "widget.paused",
      summary: status === "deployed" ? "Turned a widget on." : "Turned a widget off.",
      metadata: {
        widgetId: loaded.widget.id,
        widgetName: loaded.widget.name,
      },
    });
  } catch (error) {
    console.error("Failed to write widget status audit log", error);
  }

  return NextResponse.json({ ok: true, status });
}
