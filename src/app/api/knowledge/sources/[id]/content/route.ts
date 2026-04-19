import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
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
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase, user);
  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (error || !source) {
    return errorResponse("Knowledge source not found.", 404);
  }

  const knowledgeSource = source as KnowledgeSourceRecord;

  if (knowledgeSource.source_type === "text" || knowledgeSource.source_type === "website") {
    if (!knowledgeSource.raw_text) {
      return errorResponse("No content available.", 404);
    }

    return successResponse({
      type: "text",
      content: knowledgeSource.raw_text,
      name: knowledgeSource.name,
      mimeType: knowledgeSource.source_type === "website" ? "text/markdown" : "text/plain",
    });
  }

  if (knowledgeSource.source_type === "file") {
    if (!knowledgeSource.storage_bucket || !knowledgeSource.storage_path) {
      return errorResponse("File storage path not available.", 404);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(knowledgeSource.storage_bucket)
      .createSignedUrl(knowledgeSource.storage_path, 60 * 60, {
        download: false,
      });

    if (signedUrlError || !signedUrlData) {
      return errorResponse(
        signedUrlError?.message ?? "Failed to generate download URL.",
        500
      );
    }

    return successResponse({
      type: "file",
      url: signedUrlData.signedUrl,
      name: knowledgeSource.name,
      mimeType: knowledgeSource.mime_type ?? "application/octet-stream",
      fileSizeBytes: knowledgeSource.file_size_bytes,
    });
  }

  return errorResponse("Unsupported source type.");
}