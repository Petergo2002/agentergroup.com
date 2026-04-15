import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import type { KnowledgeSourceRecord } from "@/lib/types";

export async function PATCH(
  request: Request,
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

  if (knowledgeSource.source_type !== "text") {
    return NextResponse.json({ error: "Only text sources can be edited." }, { status: 400 });
  }

  const body = await request.json();
  const { rawText } = body;

  if (typeof rawText !== "string") {
    return NextResponse.json({ error: "rawText is required." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("knowledge_sources")
    .update({ raw_text: rawText, status: "processing" })
    .eq("id", knowledgeSource.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const processResponse = await fetch(
    `${request.headers.get("origin")}/api/knowledge/sources/${knowledgeSource.id}/process`,
    { method: "POST" },
  );

  if (!processResponse.ok) {
    return NextResponse.json({ error: "Failed to re-process source." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
