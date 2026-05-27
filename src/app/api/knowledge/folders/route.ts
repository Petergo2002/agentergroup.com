import { NextRequest } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
import {
  normalizeKnowledgeFolderDescription,
  normalizeKnowledgeFolderName,
  normalizeKnowledgeFolderSourceIds,
  toKnowledgeFolderWithSources,
  type KnowledgeFolderJoinRow,
} from "@/lib/knowledge-folders";
import { createClient } from "@/lib/supabase/server";

const KNOWLEDGE_FOLDER_LIST_SELECT =
  "id, workspace_id, created_by, name, description, created_at, updated_at, sources:knowledge_folder_sources(knowledge_source_id)";

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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data, error } = await supabase
    .from("knowledge_folders")
    .select(KNOWLEDGE_FOLDER_LIST_SELECT)
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse({
    folders: ((data ?? []) as unknown as KnowledgeFolderJoinRow[]).map(
      toKnowledgeFolderWithSources,
    ),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const name = normalizeKnowledgeFolderName(body.name);
  const description = normalizeKnowledgeFolderDescription(body.description);
  const sourceIds = normalizeKnowledgeFolderSourceIds(body.sourceIds);

  if (!name) {
    return errorResponse("Folder name is required.", 400);
  }

  try {
    const validSourceIds = await getValidSourceIds(
      supabase,
      context.workspace.id,
      sourceIds,
    );

    const { data: folder, error: folderError } = await supabase
      .from("knowledge_folders")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
      })
      .select()
      .single();

    if (folderError || !folder) {
      return errorResponse(folderError?.message ?? "Failed to create folder.", 500);
    }

    if (validSourceIds.length > 0) {
      const { error: linkError } = await supabase
        .from("knowledge_folder_sources")
        .insert(
          validSourceIds.map((sourceId) => ({
            folder_id: folder.id,
            knowledge_source_id: sourceId,
          })),
        );

      if (linkError) {
        await supabase.from("knowledge_folders").delete().eq("id", folder.id);
        return errorResponse(linkError.message, 500);
      }
    }

    return successResponse({
      folder: {
        ...folder,
        sourceIds: validSourceIds,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create folder.",
      500,
    );
  }
}
