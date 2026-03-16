import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { AgentRecord, WidgetRecord } from "@/lib/types";
import {
  buildDefaultWidgetAgentInput,
  buildDefaultWidgetInput,
} from "@/lib/widgets";
import { buildWidgetSummary, loadWidgetById } from "@/lib/widgets/server";

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
  const { data, error } = await supabase
    .from("widgets")
    .select("id")
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load widgets." },
      { status: 500 },
    );
  }

  const widgetIds = ((data ?? []) as Array<{ id: string }>).map((item) => item.id);
  const widgets = await Promise.all(
    widgetIds.map(async (widgetId) => {
      const loaded = await loadWidgetById(supabase as never, widgetId);
      if (!loaded) return null;

      const summary = buildWidgetSummary(loaded.widget, loaded.widgetAgents);
      return {
        id: summary.widget.id,
        name: summary.widget.name,
        status: summary.widget.status,
        widgetPublicKey: summary.widget.widget_public_key,
        attachedAgentCount: summary.attachedAgents.length,
        hostedUrl: summary.hostedUrl,
        needsRedeploy: summary.needsRedeploy,
        updatedAt: summary.widget.updated_at,
      };
    }),
  );

  return NextResponse.json({
    widgets: widgets.filter(Boolean),
  });
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
  const widgetDefaults = buildDefaultWidgetInput(context.workspace, {
    name: requestedName,
    slug: buildWidgetSlug(requestedName),
  });

  const { data: widget, error: widgetError } = await supabase
    .from("widgets")
    .insert({
      workspace_id: context.workspace.id,
      ...widgetDefaults,
    })
    .select()
    .single();

  if (widgetError || !widget) {
    return NextResponse.json(
      { error: widgetError?.message ?? "Failed to create widget." },
      { status: 500 },
    );
  }

  const requestedAgentId =
    typeof body.agentId === "string" && body.agentId.trim() ? body.agentId.trim() : null;

  if (requestedAgentId) {
    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .eq("id", requestedAgentId)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle();

    if (agent) {
      const defaults = buildDefaultWidgetAgentInput(agent as AgentRecord);
      await supabase.from("widget_agents").insert({
        widget_id: widget.id,
        agent_id: requestedAgentId,
        ...defaults,
      });
    }
  }

  return NextResponse.json({
    id: (widget as WidgetRecord).id,
  });
}
