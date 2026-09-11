import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import {
  InvalidJsonBodyError,
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/bounded-json";
import {
  MAX_KNOWLEDGE_TEXT_REQUEST_BYTES,
  validateKnowledgeText,
} from "@/lib/knowledge-text";
import type { KnowledgeSourceRecord } from "@/lib/types";
import { knowledgeProcessingError } from "@/lib/knowledge-processing-error";
import { getVerifiedApiIdentity } from "@/lib/app/api-auth";

export const maxDuration = 150;

const DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;

function buildStorageLimitError(storageLimitBytes: number) {
  return `Storage limit exceeded. Your current plan allows ${
    storageLimitBytes / 1024 / 1024
  }MB total knowledge base storage.`;
}

function getDatabaseErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const message = Reflect.get(error, "message");
  return typeof message === "string" ? message : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, session } = await getVerifiedApiIdentity(supabase);

  if (!user || !session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bodyValue: unknown;
  try {
    bodyValue = await readJsonBodyWithLimit(
      request,
      MAX_KNOWLEDGE_TEXT_REQUEST_BYTES,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: "Text knowledge sources are limited to 1MB each." },
        { status: 413 },
      );
    }

    if (error instanceof InvalidJsonBodyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  if (!bodyValue || typeof bodyValue !== "object" || Array.isArray(bodyValue)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const textValidation = validateKnowledgeText(
    (bodyValue as Record<string, unknown>).rawText,
  );

  if (!textValidation.valid) {
    return NextResponse.json(
      { error: textValidation.error },
      { status: textValidation.code === "too_large" ? 413 : 400 },
    );
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data: source, error: sourceError } = await supabase
    .from("knowledge_sources")
    .select("id, workspace_id, name, source_type")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Knowledge source not found." }, { status: 404 });
  }

  const knowledgeSource = source as Pick<
    KnowledgeSourceRecord,
    "id" | "workspace_id" | "name" | "source_type"
  >;

  if (knowledgeSource.source_type !== "text" && knowledgeSource.source_type !== "website") {
    return NextResponse.json({ error: "Only text and website sources can be edited." }, { status: 400 });
  }

  const admin = createAdminClient();
  const updateResult = await admin.rpc("update_knowledge_source_text", {
    p_workspace_id: context.workspace.id,
    p_source_id: knowledgeSource.id,
    p_raw_text: textValidation.text,
  });

  if (updateResult.error) {
    const message = getDatabaseErrorMessage(updateResult.error);
    const storageLimit =
      context.subscription?.storage_limit_bytes ??
      DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES;

    if (message.includes("KNOWLEDGE_STORAGE_LIMIT_EXCEEDED")) {
      return NextResponse.json(
        { error: buildStorageLimitError(storageLimit) },
        { status: 402 },
      );
    }

    if (message.includes("KNOWLEDGE_SOURCE_TEXT_TOO_LARGE")) {
      return NextResponse.json(
        { error: "Text knowledge sources are limited to 1MB each." },
        { status: 413 },
      );
    }

    if (message.includes("KNOWLEDGE_SOURCE_BUSY")) {
      return NextResponse.json(
        { error: "This knowledge source is already being processed." },
        { status: 409 },
      );
    }

    console.error("Failed to update knowledge source text.", {
      sourceId: knowledgeSource.id,
      workspaceId: context.workspace.id,
      message,
    });
    return NextResponse.json(
      { error: "Failed to update knowledge source." },
      { status: 500 },
    );
  }

  const processResult = await supabase.functions.invoke(
    "process-knowledge-source",
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        sourceId: knowledgeSource.id,
      },
    },
  );

  if (processResult.error) {
    const { data: latestSource } = await admin
      .from("knowledge_sources")
      .select("status, processing_token, error_message, updated_at")
      .eq("id", knowledgeSource.id)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle();
    const failure = await knowledgeProcessingError(processResult.error, latestSource?.error_message);
    const safeFailureMessage = failure.message;

    if (latestSource?.status === "processing" && !latestSource.processing_token) {
      await admin
        .from("knowledge_sources")
        .update({
          status: "failed",
          error_message: safeFailureMessage,
        })
        .eq("id", knowledgeSource.id)
        .eq("workspace_id", context.workspace.id)
        .eq("updated_at", latestSource.updated_at)
        .eq("status", "processing");
    }

    console.error("Knowledge source processing invocation failed.", {
      sourceId: knowledgeSource.id,
      workspaceId: context.workspace.id,
      message: failure.message,
      status: failure.status,
      code: failure.code,
    });

    return NextResponse.json(
      { error: safeFailureMessage },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, processStatus: processResult.data?.status ?? "processing" });
}

export async function DELETE(
  _request: Request,
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
  const { data: source, error: sourceError } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Knowledge source not found." }, { status: 404 });
  }

  const knowledgeSource = source as KnowledgeSourceRecord;

  if (knowledgeSource.storage_bucket && knowledgeSource.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(knowledgeSource.storage_bucket)
      .remove([knowledgeSource.storage_path]);

    if (storageError) {
      return NextResponse.json(
        { error: storageError.message ?? "Failed to remove source file." },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("knowledge_sources")
    .delete()
    .eq("id", knowledgeSource.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await createAuditLog(supabase, {
    workspaceId: context.workspace.id,
    actorId: user.id,
    action: "knowledge_source.deleted",
    summary: `Deleted knowledge source "${knowledgeSource.name}".`,
    metadata: {
      knowledgeSourceId: knowledgeSource.id,
      sourceType: knowledgeSource.source_type,
      chunkCount: knowledgeSource.chunk_count,
    },
  });

  return NextResponse.json({
    ok: true,
  });
}
