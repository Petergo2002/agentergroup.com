import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord } from "@/lib/agents/access";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { toKnowledgeFolderWithSources } from "@/lib/knowledge-folders";
import type { KnowledgeFolderJoinRow } from "@/lib/knowledge-folders";
import type { KnowledgeSourceRecord } from "@/lib/types";

const KNOWLEDGE_SOURCE_LIST_SELECT =
  "id, workspace_id, created_by, name, description, source_type, status, storage_bucket, storage_path, mime_type, file_size_bytes, chunk_count, last_processed_at, error_message, metadata, created_at, updated_at";
const KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT =
  "id, workspace_id, created_by, name, description, metadata, created_at, updated_at, sources:knowledge_folder_sources(knowledge_source_id)";

interface AgentKnowledgeJoinRow {
  source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
}

interface AgentKnowledgeFolderJoinRow {
  folder: KnowledgeFolderJoinRow | KnowledgeFolderJoinRow[] | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, surface")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent as never, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  const [sourcesResult, foldersResult, availableFoldersResult] = await Promise.all([
    supabase
      .from("agent_knowledge_sources")
      .select(`source:knowledge_sources(${KNOWLEDGE_SOURCE_LIST_SELECT})`)
      .eq("agent_id", agentId),
    supabase
      .from("agent_knowledge_folders")
      .select(`folder:knowledge_folders(${KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT})`)
      .eq("agent_id", agentId),
    supabase
      .from("knowledge_folders")
      .select(KNOWLEDGE_FOLDER_WITH_SOURCES_SELECT)
      .eq("workspace_id", context.workspace.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (sourcesResult.error) {
    return NextResponse.json({ error: sourcesResult.error.message }, { status: 500 });
  }

  if (foldersResult.error) {
    return NextResponse.json({ error: foldersResult.error.message }, { status: 500 });
  }

  if (availableFoldersResult.error) {
    return NextResponse.json({ error: availableFoldersResult.error.message }, { status: 500 });
  }

  const sources = ((sourcesResult.data ?? []) as unknown as AgentKnowledgeJoinRow[])
    .map((item) => (Array.isArray(item.source) ? item.source[0] ?? null : item.source))
    .filter(Boolean) as KnowledgeSourceRecord[];
  const folders = ((foldersResult.data ?? []) as unknown as AgentKnowledgeFolderJoinRow[])
    .map((item) => (Array.isArray(item.folder) ? item.folder[0] ?? null : item.folder))
    .filter(Boolean)
    .map((folder) => toKnowledgeFolderWithSources(folder as KnowledgeFolderJoinRow));
  const availableFolders = ((availableFoldersResult.data ?? []) as unknown as KnowledgeFolderJoinRow[])
    .map((folder) => toKnowledgeFolderWithSources(folder));

  return NextResponse.json({
    sources,
    folders,
    availableFolders,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const sourceIds: string[] = Array.isArray(body.sourceIds)
    ? Array.from(new Set(body.sourceIds.map((value: unknown) => String(value)).filter(Boolean)))
    : [];
  const folderIds: string[] = Array.isArray(body.folderIds)
    ? Array.from(new Set(body.folderIds.map((value: unknown) => String(value)).filter(Boolean)))
    : [];

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, workspace_id, surface, created_by")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent as never, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  if (!canEditAgentRecord(agent as never, user.id, context.membership.role)) {
    return NextResponse.json(
      { error: "You do not have permission to edit this agent." },
      { status: 403 },
    );
  }

  let finalSourceIdsToInsert: string[] = sourceIds;
  let finalFolderIdsToInsert: string[] = folderIds;

  if (sourceIds.length > 0) {
    const { data: validSources, error: validSourcesError } = await supabase
      .from("knowledge_sources")
      .select("id")
      .eq("workspace_id", context.workspace.id)
      .in("id", sourceIds);

    if (validSourcesError) {
      return NextResponse.json({ error: validSourcesError.message }, { status: 500 });
    }

    finalSourceIdsToInsert = (validSources ?? []).map((s) => s.id);
  }

  if (folderIds.length > 0) {
    const { data: validFolders, error: validFoldersError } = await supabase
      .from("knowledge_folders")
      .select("id")
      .eq("workspace_id", context.workspace.id)
      .in("id", folderIds);

    if (validFoldersError) {
      return NextResponse.json({ error: validFoldersError.message }, { status: 500 });
    }

    finalFolderIdsToInsert = (validFolders ?? []).map((folder) => folder.id);
  }

  const [deleteSourcesResult, deleteFoldersResult] = await Promise.all([
    supabase.from("agent_knowledge_sources").delete().eq("agent_id", agentId),
    supabase.from("agent_knowledge_folders").delete().eq("agent_id", agentId),
  ]);

  if (deleteSourcesResult.error) {
    return NextResponse.json({ error: deleteSourcesResult.error.message }, { status: 500 });
  }

  if (deleteFoldersResult.error) {
    return NextResponse.json({ error: deleteFoldersResult.error.message }, { status: 500 });
  }

  if (finalSourceIdsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("agent_knowledge_sources").insert(
      finalSourceIdsToInsert.map((sourceId) => ({
        agent_id: agentId,
        knowledge_source_id: sourceId,
      })),
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  if (finalFolderIdsToInsert.length > 0) {
    const { error: insertFoldersError } = await supabase.from("agent_knowledge_folders").insert(
      finalFolderIdsToInsert.map((folderId) => ({
        agent_id: agentId,
        knowledge_folder_id: folderId,
      })),
    );

    if (insertFoldersError) {
      return NextResponse.json({ error: insertFoldersError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
