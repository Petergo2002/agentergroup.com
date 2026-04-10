import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClientSafeError, json } from "../_shared/http.ts";
import { chunkKnowledgeText, extractTextFromFile, normalizeKnowledgeText } from "../_shared/knowledge.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (request) => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const sourceId = String(body.sourceId ?? "").trim();

  if (!sourceId) {
    return json({ error: "sourceId is required." }, 400);
  }

  const { data: source, error: sourceError } = await userClient
    .from("knowledge_sources")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    return json({ error: "Knowledge source not found." }, 404);
  }

  await adminClient
    .from("knowledge_sources")
    .update({
      status: "processing",
      error_message: null,
    })
    .eq("id", sourceId);

  try {
    let rawText = source.raw_text as string | null;

    if (source.source_type === "file") {
      if (!source.storage_bucket || !source.storage_path || !source.mime_type) {
        throw new Error("File source is missing storage metadata.");
      }

      const download = await adminClient.storage
        .from(source.storage_bucket)
        .download(source.storage_path);

      if (download.error || !download.data) {
        throw download.error ?? new Error("Failed to download file content.");
      }

      const bytes = new Uint8Array(await download.data.arrayBuffer());
      rawText = await extractTextFromFile(bytes, source.mime_type);
    }

    const normalizedText = normalizeKnowledgeText(rawText ?? "");
    const chunks = chunkKnowledgeText(normalizedText);

    if (chunks.length === 0) {
      throw new Error("No readable text was found in this source.");
    }

    const chunkRows: Array<Record<string, unknown>> = [];

    for (const chunk of chunks) {
      const embedding = await model.run(chunk.content, {
        mean_pool: true,
        normalize: true,
      });

      chunkRows.push({
        source_id: source.id,
        workspace_id: source.workspace_id,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        content_length: chunk.contentLength,
        embedding: JSON.stringify(embedding),
        metadata: {
          sourceType: source.source_type,
          sourceName: source.name,
          chunkIndex: chunk.chunkIndex,
          contentLength: chunk.contentLength,
          ingestionVersion: 1,
        },
      });
    }

    const deleteResult = await adminClient
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", source.id);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    const insertResult = await adminClient.from("knowledge_chunks").insert(chunkRows);

    if (insertResult.error) {
      throw insertResult.error;
    }

    const updateResult = await adminClient
      .from("knowledge_sources")
      .update({
        status: "ready",
        chunk_count: chunkRows.length,
        last_processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", source.id);

    if (updateResult.error) {
      throw updateResult.error;
    }

    return json({
      ok: true,
      sourceId: source.id,
      chunkCount: chunkRows.length,
    });
  } catch (error) {
    const safeError = buildClientSafeError(
      "process-knowledge-source",
      error,
      "Knowledge processing failed.",
    );
    await adminClient
      .from("knowledge_sources")
      .update({
        status: "failed",
        chunk_count: 0,
        error_message: error instanceof Error ? error.message : "Knowledge processing failed.",
      })
      .eq("id", source.id);

    return json(safeError, 500);
  }
});
