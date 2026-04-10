import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClientSafeError, json } from "../_shared/http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (request) => {
  const authHeader = request.headers.get("Authorization");
  const internalServiceKey = request.headers.get("x-internal-service-key");
  const apiKeyHeader = request.headers.get("apikey");
  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "").trim();
  const agentId = String(body.agentId ?? "").trim();
  const query = String(body.query ?? "").trim();
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
  if (!authHeader && !isInternalRequest) {
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

  if (!isInternalRequest) {
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

  const result = await (isInternalRequest ? adminClient : supabase).rpc(
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
    return json(
      buildClientSafeError(
        "search-knowledge",
        result.error,
        "Knowledge search failed.",
      ),
      500,
    );
  }

  return json({
    matches: result.data ?? [],
  });
});
