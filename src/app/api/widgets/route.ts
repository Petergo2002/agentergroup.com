import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { AgentRecord, WidgetRecord } from "@/lib/types";
import {
  buildDefaultWidgetAgentInput,
  buildDefaultWidgetInput,
} from "@/lib/widgets";
import { buildWidgetSummary, loadAllWidgetsWithAgents } from "@/lib/widgets/server";
import {
  buildWidgetLimitError,
  canCreateWidget,
  getWidgetLimitForPlan,
} from "@/lib/widget-limits";

const WIDGET_AGENT_SEED_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";

function buildWidgetSlug(name: string) {
  const base = slugify(name) || "widget";
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  try {
    const allWidgets = await loadAllWidgetsWithAgents(supabase as never, context.workspace.id);

    const widgets = allWidgets.map((loaded) => {
      const summary = buildWidgetSummary(loaded.widget, loaded.widgetAgents);
      return {
        id: summary.widget.id,
        name: summary.widget.name,
        description: summary.widget.description,
        status: summary.widget.status,
        widgetPublicKey: summary.widget.widget_public_key,
        attachedAgentCount: summary.attachedAgents.length,
        hostedUrl: summary.hostedUrl,
        needsRedeploy: summary.needsRedeploy,
        updatedAt: summary.widget.updated_at,
      };
    });

    return NextResponse.json({
      widgets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load widgets." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const requestedName =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Widget";
  const requestedDescription =
    typeof body.description === "string" ? body.description.trim().slice(0, 200) : "";
  const requestedAgentId =
    typeof body.agentId === "string" && body.agentId.trim() ? body.agentId.trim() : null;
  let seededAgent: AgentRecord | null = null;

  const { count: widgetCount, error: widgetCountError } = await supabase
    .from("widgets")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", context.workspace.id);

  if (widgetCountError) {
    return NextResponse.json(
      { error: widgetCountError.message || "Failed to check widget limit." },
      { status: 500 },
    );
  }

  const currentWidgetCount = widgetCount ?? 0;
  const widgetLimit = getWidgetLimitForPlan(context.subscription?.plan_tier);

  if (
    !canCreateWidget({
      plan: context.subscription?.plan_tier,
      widgetCount: currentWidgetCount,
    })
  ) {
    return NextResponse.json(
      {
        error: buildWidgetLimitError(context.subscription?.plan_tier),
        code: "widget_limit_reached",
        widgetLimit,
        widgetCount: currentWidgetCount,
      },
      { status: 403 },
    );
  }

  if (requestedAgentId) {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(WIDGET_AGENT_SEED_SELECT)
      .eq("id", requestedAgentId)
      .eq("workspace_id", context.workspace.id)
      .eq("surface", "widget")
      .maybeSingle();

    if (agentError) {
      return NextResponse.json(
        { error: agentError.message || "Failed to load the requested agent." },
        { status: 500 },
      );
    }

    if (!agent) {
      return NextResponse.json(
        { error: "Only website widget agents can seed a widget." },
        { status: 400 },
      );
    }

    seededAgent = agent as AgentRecord;
  }

  const widgetDefaults = buildDefaultWidgetInput(context.workspace, {
    name: requestedName,
    slug: buildWidgetSlug(requestedName),
  });

  const { data: widget, error: widgetError } = await supabase
    .from("widgets")
    .insert({
      workspace_id: context.workspace.id,
      ...widgetDefaults,
      description: requestedDescription,
    })
    .select("id")
    .single();

  if (widgetError || !widget) {
    if (widgetError?.message.includes("WIDGET_LIMIT_REACHED")) {
      return NextResponse.json(
        {
          error: buildWidgetLimitError(context.subscription?.plan_tier),
          code: "widget_limit_reached",
          widgetLimit,
          widgetCount: currentWidgetCount,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: widgetError?.message ?? "Failed to create widget." },
      { status: 500 },
    );
  }

  if (seededAgent) {
    const defaults = buildDefaultWidgetAgentInput(seededAgent);
    await supabase.from("widget_agents").insert({
      widget_id: widget.id,
      agent_id: seededAgent.id,
      ...defaults,
    });
  }

  return NextResponse.json({
    id: (widget as WidgetRecord).id,
  });
}
