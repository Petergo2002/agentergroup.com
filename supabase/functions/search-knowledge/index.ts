import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClientSafeError, json } from "../_shared/http.ts";

function readFirstSupabaseSecretKey() {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeysJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;

    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const keyValue = record.key ?? record.value ?? record.secret ?? record.api_key;

        if (typeof keyValue === "string" && keyValue.trim()) {
          return keyValue.trim();
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabasePublishableKey =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseAdminKey =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  readFirstSupabaseSecretKey()!;
const model = new Supabase.ai.Session("gte-small");

function extractBearerToken(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || value.trim();
}

function getConfiguredSecretKeys() {
  const keys = [
    Deno.env.get("SUPABASE_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseAdminKey,
  ];
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysJson) {
    try {
      const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;

      for (const value of Object.values(parsed)) {
        if (typeof value === "string") {
          keys.push(value);
          continue;
        }

        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          const keyValue = record.key ?? record.value ?? record.secret ?? record.api_key;

          if (typeof keyValue === "string") {
            keys.push(keyValue);
          }
        }
      }
    } catch {
      // Ignore malformed platform metadata and rely on explicit secrets.
    }
  }

  return new Set(keys.map((key) => key?.trim()).filter(Boolean) as string[]);
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed,
  )
    ? trimmed
    : null;
}

Deno.serve(async (request) => {
  const authHeader = request.headers.get("Authorization");
  const internalServiceKey = request.headers.get("x-internal-service-key");
  const apiKeyHeader = request.headers.get("apikey");
  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "").trim();
  const agentId = String(body.agentId ?? "").trim();
  const query = String(body.query ?? "").trim();
  const widgetSessionId = normalizeUuid(body.widgetSessionId);
  const matchThreshold = Number(body.matchThreshold ?? 0.7);
  const matchCount = Math.min(Number(body.matchCount ?? 8), 20);
  const configuredSecretKeys = getConfiguredSecretKeys();
  const requestKeys = [
    internalServiceKey,
    apiKeyHeader,
    extractBearerToken(authHeader),
    authHeader,
  ].map((value) => value?.trim()).filter(Boolean) as string[];
  const isInternalRequest = requestKeys.some((key) => configuredSecretKeys.has(key));

  const adminClient = createClient(supabaseUrl, supabaseAdminKey);
  if (!authHeader && !isInternalRequest) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
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

  const searchClient = isInternalRequest ? adminClient : supabase;
  let result = await searchClient.rpc("match_agent_knowledge_chunks", {
    input_workspace_id: workspaceId,
    input_agent_id: agentId,
    input_widget_session_id: widgetSessionId,
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (result.error?.code === "PGRST202") {
    result = await searchClient.rpc("match_agent_knowledge_chunks", {
      input_workspace_id: workspaceId,
      input_agent_id: agentId,
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });
  }

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
