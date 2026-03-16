import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import type { AgentRecord } from "@/lib/types";
import { buildDefaultWidgetAgentInput } from "@/lib/widgets";
import { buildWidgetSummary, loadWidgetById } from "@/lib/widgets/server";

interface AgentPayload {
  agentId: string;
  label?: string;
  description?: string;
  icon?: string | null;
  sortOrder?: number;
  interactionMode?: "chat" | "contact_form";
  greeting?: string;
  placeholder?: string;
  showQuickActions?: boolean;
  quickActions?: unknown[];
  contactFormSettings?: Record<string, unknown>;
}

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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const loaded = await loadWidgetById(supabase as never, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.agents) ? (body.agents as AgentPayload[]) : [];
  const requestedAgentIds = Array.from(
    new Set(
      items
        .map((item) => (typeof item.agentId === "string" ? item.agentId.trim() : ""))
        .filter(Boolean),
    ),
  );

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .in("id", requestedAgentIds);

  if (agentsError) {
    return NextResponse.json(
      { error: agentsError.message || "Failed to load agents." },
      { status: 500 },
    );
  }

  const availableAgentMap = new Map(
    ((agents ?? []) as AgentRecord[]).map((agent) => [agent.id, agent]),
  );

  if (availableAgentMap.size !== requestedAgentIds.length) {
    return NextResponse.json(
      { error: "One or more agents could not be attached to this widget." },
      { status: 400 },
    );
  }

  const existingByAgentId = new Map(
    loaded.widgetAgents.map(({ widgetAgent }) => [widgetAgent.agent_id, widgetAgent]),
  );
  const requestedAgentIdSet = new Set(requestedAgentIds);
  const removedWidgetAgentIds = loaded.widgetAgents
    .filter(({ widgetAgent }) => !requestedAgentIdSet.has(widgetAgent.agent_id))
    .map(({ widgetAgent }) => widgetAgent.id);

  if (removedWidgetAgentIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("widget_agents")
      .delete()
      .in("id", removedWidgetAgentIds);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "Failed to remove attached agents." },
        { status: 500 },
      );
    }
  }

  if (items.length > 0) {
    const rows = items.map((item, index) => {
      const agent = availableAgentMap.get(item.agentId)!;
      const defaults = buildDefaultWidgetAgentInput(agent);
      const existing = existingByAgentId.get(agent.id);

      return {
        widget_id: id,
        agent_id: agent.id,
        published_version_id: existing?.published_version_id ?? null,
        label:
          typeof item.label === "string" && item.label.trim()
            ? item.label.trim()
            : defaults.label,
        description:
          typeof item.description === "string"
            ? item.description.trim()
            : defaults.description,
        icon:
          typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : null,
        sort_order: typeof item.sortOrder === "number" ? item.sortOrder : index,
        interaction_mode:
          item.interactionMode === "contact_form" ? "contact_form" : "chat",
        greeting:
          typeof item.greeting === "string" && item.greeting.trim()
            ? item.greeting.trim()
            : defaults.greeting,
        placeholder:
          typeof item.placeholder === "string" && item.placeholder.trim()
            ? item.placeholder.trim()
            : defaults.placeholder,
        show_quick_actions:
          typeof item.showQuickActions === "boolean"
            ? item.showQuickActions
            : existing?.show_quick_actions ?? defaults.show_quick_actions,
        quick_actions: Array.isArray(item.quickActions)
          ? item.quickActions
          : existing?.quick_actions ?? defaults.quick_actions,
        contact_form_settings:
          typeof item.contactFormSettings === "object" && item.contactFormSettings
            ? item.contactFormSettings
            : defaults.contact_form_settings,
      };
    });

    const { error: upsertError } = await supabase
      .from("widget_agents")
      .upsert(rows, { onConflict: "widget_id,agent_id" });

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message || "Failed to save attached agents." },
        { status: 500 },
      );
    }
  }

  const nextLoaded = await loadWidgetById(supabase as never, id);

  if (!nextLoaded) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  return NextResponse.json(buildWidgetSummary(nextLoaded.widget, nextLoaded.widgetAgents, {
    preview: true,
  }));
}
