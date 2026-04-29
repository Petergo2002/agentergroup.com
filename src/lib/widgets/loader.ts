import type { AgentRecord, AgentVersionRecord, WidgetAgentRecord, WidgetRecord } from "@/lib/types";
import type { WidgetAdminSupabase, WidgetOrderedSelectBuilder, WidgetInSelectBuilder, WidgetQueryResult } from "./server-types";
import type { WidgetAgentWithAgent } from "@/lib/widgets";

interface WorkspacePlanTierRow {
  plan_tier: string | null;
}

async function loadCanHideWidgetBranding(
  supabase: WidgetAdminSupabase,
  workspaceId: string,
) {
  const { data, error } = (await supabase
    .from("workspace_subscriptions")
    .select("plan_tier")
    .eq("workspace_id", workspaceId)
    .maybeSingle()) as {
    data: WorkspacePlanTierRow | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(error.message);
  }

  return data?.plan_tier === "premium";
}

async function normalizeWidgetBrandingEntitlement(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
) {
  const canHideBranding = await loadCanHideWidgetBranding(
    supabase,
    widget.workspace_id,
  );

  if (canHideBranding || widget.show_branding) {
    return widget;
  }

  return {
    ...widget,
    show_branding: true,
  };
}

async function loadWidgetAgentsWithAgents(
  supabase: WidgetAdminSupabase,
  widgetId: string,
) {
  const widgetAgentsQuery = supabase
    .from("widget_agents")
    .select<WidgetAgentRecord>("*") as unknown as WidgetOrderedSelectBuilder<WidgetAgentRecord>;

  const { data: widgetAgentRows, error: widgetAgentsError } = await widgetAgentsQuery
    .eq("widget_id", widgetId)
    .order("sort_order", { ascending: true })
    .limit(1000);

  if (widgetAgentsError) {
    throw new Error(widgetAgentsError.message);
  }

  const typedWidgetAgents = (widgetAgentRows ?? []) as WidgetAgentRecord[];

  if (typedWidgetAgents.length === 0) {
    return [] as WidgetAgentWithAgent[];
  }

  const agentIds = Array.from(
    new Set(typedWidgetAgents.map((widgetAgent) => widgetAgent.agent_id).filter(Boolean)),
  );

  const agentsQuery = supabase
    .from("agents")
    .select<AgentRecord>("*") as unknown as WidgetInSelectBuilder<AgentRecord>;

  const { data: agentRows, error: agentsError } = await agentsQuery
    .in("id", agentIds);

  if (agentsError) {
    throw new Error(agentsError.message);
  }

  const agentById = new Map(
    ((agentRows ?? []) as AgentRecord[]).map((agent) => [agent.id, agent]),
  );

  return typedWidgetAgents
    .map((widgetAgent) => {
      const agent = agentById.get(widgetAgent.agent_id);
      if (!agent) {
        return null;
      }

      return {
        widgetAgent,
        agent,
      };
    })
    .filter(Boolean) as WidgetAgentWithAgent[];
}

export async function loadWidgetById(
  supabase: WidgetAdminSupabase,
  widgetId: string,
) {
  const { data, error } = await supabase
    .from("widgets")
    .select("*")
    .eq("id", widgetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = await normalizeWidgetBrandingEntitlement(
    supabase,
    data as WidgetRecord,
  );
  return {
    widget: row,
    widgetAgents: await loadWidgetAgentsWithAgents(supabase, row.id),
  };
}

export async function loadWidgetByPublicKey(
  supabase: WidgetAdminSupabase,
  widgetPublicKey: string,
) {
  const { data, error } = await supabase
    .from("widgets")
    .select("*")
    .eq("widget_public_key", widgetPublicKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = await normalizeWidgetBrandingEntitlement(
    supabase,
    data as WidgetRecord,
  );
  return {
    widget: row,
    widgetAgents: await loadWidgetAgentsWithAgents(supabase, row.id),
  };
}

export async function loadAllWidgetsWithAgents(
  supabase: WidgetAdminSupabase,
  workspaceId: string,
) {
  const { data: widgetsData, error: widgetsError } = await (supabase
    .from("widgets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false }) as unknown as Promise<{ data: WidgetRecord[] | null; error: { message: string } | null }>);

  if (widgetsError) {
    throw new Error(widgetsError.message);
  }

  if (!widgetsData || widgetsData.length === 0) {
    return [];
  }

  const canHideBranding = await loadCanHideWidgetBranding(supabase, workspaceId);
  const widgets = widgetsData.map((widget) =>
    canHideBranding || widget.show_branding
      ? widget
      : { ...widget, show_branding: true },
  );
  const widgetIds = widgets.map((w) => w.id);

  const { data: widgetAgentsData, error: widgetAgentsError } = await (supabase
    .from("widget_agents")
    .select("*")
    .in("widget_id", widgetIds) as unknown as Promise<{ data: WidgetAgentRecord[] | null; error: { message: string } | null }>);

  if (widgetAgentsError) {
    throw new Error(widgetAgentsError.message);
  }

  const widgetAgentsByWidgetId = new Map<string, WidgetAgentRecord[]>();
  for (const wa of widgetAgentsData ?? []) {
    const existing = widgetAgentsByWidgetId.get(wa.widget_id) ?? [];
    existing.push(wa);
    widgetAgentsByWidgetId.set(wa.widget_id, existing);
  }

  const agentIds = Array.from(
    new Set(
      (widgetAgentsData ?? [])
        .map((wa) => wa.agent_id)
        .filter(Boolean) as string[],
    ),
  );

  let agents: AgentRecord[] = [];
  if (agentIds.length > 0) {
    const { data: agentsData, error: agentsError } = await (supabase
      .from("agents")
      .select("*")
      .in("id", agentIds) as unknown as Promise<{ data: AgentRecord[] | null; error: { message: string } | null }>);

    if (agentsError) {
      throw new Error(agentsError.message);
    }

    agents = agentsData ?? [];
  }

  const agentById = new Map(agents.map((a) => [a.id, a]));

  return widgets.map((widget) => {
    const widgetAgents = (widgetAgentsByWidgetId.get(widget.id) ?? [])
      .map((wa) => {
        const agent = agentById.get(wa.agent_id);
        if (!agent) return null;
        return { widgetAgent: wa, agent };
      })
      .filter(Boolean) as WidgetAgentWithAgent[];

    return {
      widget,
      widgetAgents,
    };
  });
}

export async function getPublishedAgentVersion(
  supabase: WidgetAdminSupabase,
  publishedVersionId: string | null,
) {
  if (!publishedVersionId) {
    return null;
  }

  const { data, error } = await supabase
    .from("agent_versions")
    .select("*")
    .eq("id", publishedVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AgentVersionRecord | null;
}

export async function loadWidgetAgentsByIds(
  supabase: WidgetAdminSupabase,
  workspaceId: string,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return [] as AgentRecord[];
  }

  const table = supabase.from("agents");
  const selectBuilder = table.select("*").eq("workspace_id", workspaceId);

  const result = "in" in selectBuilder
    ? await (
        selectBuilder as WidgetQueryResult<unknown[]> & {
          in: (column: string, values: string[]) => Promise<WidgetQueryResult<unknown[]>>;
        }
      ).in("id", agentIds)
    : await selectBuilder.maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = Array.isArray(result.data)
    ? result.data
    : result.data
      ? [result.data]
      : [];

  return (rows as AgentRecord[]).filter((agent) => !agent.archived_at);
}
