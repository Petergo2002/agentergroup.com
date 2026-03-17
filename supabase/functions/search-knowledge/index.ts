import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const model = new Supabase.ai.Session("gte-small");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  const authHeader = request.headers.get("Authorization");
  const internalServiceKey = request.headers.get("x-internal-service-key");
  const apiKeyHeader = request.headers.get("apikey");
  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "").trim();
  const agentId = String(body.agentId ?? "").trim();
  const query = String(body.query ?? "").trim();
  const widgetPublicKey = String(body.widgetPublicKey ?? "").trim();
  const matchThreshold = Number(body.matchThreshold ?? 0.7);
  const matchCount = Math.min(Number(body.matchCount ?? 8), 20);
  const internalAuthorization =
    authHeader === `Bearer ${supabaseServiceRoleKey}` ||
    authHeader === supabaseServiceRoleKey;
  const isInternalRequest =
    (internalServiceKey && internalServiceKey === supabaseServiceRoleKey) ||
    (apiKeyHeader && apiKeyHeader === supabaseServiceRoleKey) ||
    internalAuthorization;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  let isWidgetScopedRequest = false;

  if (!isInternalRequest && widgetPublicKey && agentId) {
    const { data: widgetAgent, error: widgetAgentError } = await adminClient
      .from("widget_agents")
      .select("id, widget:widgets!inner(id, workspace_id, status, widget_public_key)")
      .eq("agent_id", agentId)
      .eq("widgets.widget_public_key", widgetPublicKey)
      .maybeSingle();

    if (widgetAgentError) {
      return json({ error: widgetAgentError.message }, 500);
    }

    const resolvedWidget = widgetAgent?.widget;
    if (
      widgetAgent &&
      resolvedWidget &&
      typeof resolvedWidget === "object" &&
      resolvedWidget !== null &&
      "workspace_id" in resolvedWidget &&
      "status" in resolvedWidget &&
      resolvedWidget.workspace_id === workspaceId &&
      (resolvedWidget.status === "deployed" || resolvedWidget.status === "draft")
    ) {
      isWidgetScopedRequest = true;
    }
  }

  if (!authHeader && !isInternalRequest && !isWidgetScopedRequest) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader
        ? {
            Authorization: authHeader,
          }
        : {},
    },
  });

  if (!isInternalRequest && !isWidgetScopedRequest) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  if (!workspaceId || !agentId || !query) {
    return json({ error: "workspaceId, agentId, and query are required." }, 400);
  }

  const embedding = await model.run(query, {
    mean_pool: true,
    normalize: true,
  });

  const result = await (isInternalRequest || isWidgetScopedRequest ? adminClient : supabase).rpc(
    "match_agent_knowledge_chunks",
    {
      input_workspace_id: workspaceId,
    input_agent_id: agentId,
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    },
  );

  if (result.error) {
    return json({ error: result.error.message }, 500);
  }

  return json({
    matches: result.data ?? [],
  });
});
