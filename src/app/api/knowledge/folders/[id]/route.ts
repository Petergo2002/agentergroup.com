import { NextRequest } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
import {
  normalizeKnowledgeFolderDescription,
  normalizeKnowledgeFolderName,
  normalizeKnowledgeFolderSourceIds,
} from "@/lib/knowledge-folders";
import { createClient } from "@/lib/supabase/server";

async function getFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  folderId: string,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .select("*")
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getValidSourceIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", sourceIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((source) => source.id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: folderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const folder = await getFolder(supabase, folderId, context.workspace.id);

  if (!folder) {
    return errorResponse("Folder not found.", 404);
  }

  const update: Record<string, string> = {};

  if ("name" in body) {
    const name = normalizeKnowledgeFolderName(body.name);
    if (!name) {
      return errorResponse("Folder name is required.", 400);
    }
    update.name = name;
  }

  if ("description" in body) {
    update.description = normalizeKnowledgeFolderDescription(body.description);
  }

  try {
    let nextFolder = folder;
    if (Object.keys(update).length > 0) {
      const { data, error } = await supabase
        .from("knowledge_folders")
        .update(update)
        .eq("id", folderId)
        .eq("workspace_id", context.workspace.id)
        .select()
        .single();

      if (error || !data) {
        return errorResponse(error?.message ?? "Failed to update folder.", 500);
      }
      nextFolder = data;
    }

    let sourceIds: string[] | null = null;
    if ("sourceIds" in body) {
      sourceIds = await getValidSourceIds(
        supabase,
        context.workspace.id,
        normalizeKnowledgeFolderSourceIds(body.sourceIds),
      );

      const { error: deleteError } = await supabase
        .from("knowledge_folder_sources")
        .delete()
        .eq("folder_id", folderId);

      if (deleteError) {
        return errorResponse(deleteError.message, 500);
      }

      if (sourceIds.length > 0) {
        const { error: insertError } = await supabase
          .from("knowledge_folder_sources")
          .insert(
            sourceIds.map((sourceId) => ({
              folder_id: folderId,
              knowledge_source_id: sourceId,
            })),
          );

        if (insertError) {
          return errorResponse(insertError.message, 500);
        }
      }
    }

    if (!sourceIds) {
      const { data, error } = await supabase
        .from("knowledge_folder_sources")
        .select("knowledge_source_id")
        .eq("folder_id", folderId);

      if (error) {
        return errorResponse(error.message, 500);
      }

      sourceIds = (data ?? []).map((source) => source.knowledge_source_id);
    }

    return successResponse({
      folder: {
        ...nextFolder,
        sourceIds,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update folder.",
      500,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: folderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const folder = await getFolder(supabase, folderId, context.workspace.id);

  if (!folder) {
    return errorResponse("Folder not found.", 404);
  }

  const { error } = await supabase
    .from("knowledge_folders")
    .delete()
    .eq("id", folderId)
    .eq("workspace_id", context.workspace.id);

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse({ ok: true });
}
