import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import type { KnowledgeSourceRecord } from "@/lib/types";

export async function GET(
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
  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (error || !source) {
    return NextResponse.json({ error: "Knowledge source not found." }, { status: 404 });
  }

  const knowledgeSource = source as KnowledgeSourceRecord;

  if (knowledgeSource.source_type === "text") {
    if (!knowledgeSource.raw_text) {
      return NextResponse.json({ error: "No content available." }, { status: 404 });
    }

    return NextResponse.json({
      type: "text",
      content: knowledgeSource.raw_text,
      name: knowledgeSource.name,
      mimeType: "text/plain",
    });
  }

  if (knowledgeSource.source_type === "file") {
    if (!knowledgeSource.storage_bucket || !knowledgeSource.storage_path) {
      return NextResponse.json({ error: "File storage path not available." }, { status: 404 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(knowledgeSource.storage_bucket)
      .createSignedUrl(knowledgeSource.storage_path, 60 * 60, {
        download: false,
      });

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: signedUrlError?.message ?? "Failed to generate download URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      type: "file",
      url: signedUrlData.signedUrl,
      name: knowledgeSource.name,
      mimeType: knowledgeSource.mime_type ?? "application/octet-stream",
      fileSizeBytes: knowledgeSource.file_size_bytes,
    });
  }

  return NextResponse.json({ error: "Unsupported source type." }, { status: 400 });
}