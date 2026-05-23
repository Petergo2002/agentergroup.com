import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { canEditAgentRecord } from "@/lib/agents/access";
import {
  buildContentFromKnowledgeChunks,
  buildTemplateSlug,
  getKnowledgeFolderIdsFromDefinition,
  getKnowledgeSourceIdsFromDefinition,
  getRequiredIntegrationsFromDefinition,
  sanitizeBuilderDefinitionForTemplate,
} from "@/lib/agent-library";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentRecord,
  BuilderDefinition,
  KnowledgeSourceRecord,
} from "@/lib/types";

type AttachedKnowledgeRow = {
  knowledge_source_id: string;
  source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
};

type AttachedKnowledgeFolderRow = {
  knowledge_folder_id: string;
  folder:
    | {
        sources?: Array<{
          source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
        }>;
      }
    | Array<{
        sources?: Array<{
          source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
        }>;
      }>
    | null;
};

type KnowledgeChunkRow = {
  source_id: string;
  chunk_index: number;
  content: string;
};

function normalizeSource(source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null) {
  return Array.isArray(source) ? source[0] ?? null : source;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const agentId = String(body.agentId ?? "").trim();

  if (!agentId) {
    return errorResponse("agentId is required.", 400);
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (agentError) {
    return errorResponse(agentError.message, 500);
  }

  if (!agent) {
    return errorResponse("Agent not found.", 404);
  }

  const agentRecord = agent as AgentRecord;
  if (!canEditAgentRecord(agentRecord, user.id, context.membership.role)) {
    return errorResponse("You do not have permission to publish this agent.", 403);
  }

  const { data: draft, error: draftError } = await supabase
    .from("agent_drafts")
    .select("definition")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (draftError) {
    return errorResponse(draftError.message, 500);
  }

  if (!draft?.definition) {
    return errorResponse("Save this agent before publishing it to the library.", 400);
  }

  const definition = draft.definition as BuilderDefinition;
  const definitionSourceIds = getKnowledgeSourceIdsFromDefinition(definition);
  const definitionFolderIds = getKnowledgeFolderIdsFromDefinition(definition);
  const [attachedSourcesResult, attachedFoldersResult] = await Promise.all([
    supabase
      .from("agent_knowledge_sources")
      .select("knowledge_source_id, source:knowledge_sources(*)")
      .eq("agent_id", agentId),
    supabase
      .from("agent_knowledge_folders")
      .select("knowledge_folder_id, folder:knowledge_folders(sources:knowledge_folder_sources(source:knowledge_sources(*)))")
      .eq("agent_id", agentId),
  ]);

  if (attachedSourcesResult.error) {
    return errorResponse(attachedSourcesResult.error.message, 500);
  }

  if (attachedFoldersResult.error) {
    return errorResponse(attachedFoldersResult.error.message, 500);
  }

  const attachedSources = ((attachedSourcesResult.data ?? []) as unknown as AttachedKnowledgeRow[])
    .map((row) => normalizeSource(row.source))
    .filter((source): source is KnowledgeSourceRecord => Boolean(source));
  const selectedSourceIdSet =
    definitionSourceIds.length > 0 ? new Set(definitionSourceIds) : null;
  const selectedDirectSources = attachedSources.filter(
    (source) => !selectedSourceIdSet || selectedSourceIdSet.has(source.id),
  );
  const selectedFolderIdSet =
    definitionFolderIds.length > 0 ? new Set(definitionFolderIds) : null;
  const selectedFolderSources = ((attachedFoldersResult.data ?? []) as unknown as AttachedKnowledgeFolderRow[])
    .filter((row) => !selectedFolderIdSet || selectedFolderIdSet.has(row.knowledge_folder_id))
    .flatMap((row) => {
      const folder = Array.isArray(row.folder) ? row.folder[0] ?? null : row.folder;
      return (folder?.sources ?? [])
        .map((link) => normalizeSource(link.source))
        .filter((source): source is KnowledgeSourceRecord => Boolean(source));
    });
  const selectedSources = Array.from(
    new Map(
      [...selectedDirectSources, ...selectedFolderSources].map((source) => [source.id, source]),
    ).values(),
  );

  const fileSourceIds = selectedSources
    .filter((source) => source.source_type === "file")
    .map((source) => source.id);
  const chunksBySource = new Map<string, KnowledgeChunkRow[]>();

  if (fileSourceIds.length > 0) {
    const { data: chunks, error: chunksError } = await supabase
      .from("knowledge_chunks")
      .select("source_id, chunk_index, content")
      .in("source_id", fileSourceIds);

    if (chunksError) {
      return errorResponse(chunksError.message, 500);
    }

    for (const chunk of (chunks ?? []) as KnowledgeChunkRow[]) {
      const current = chunksBySource.get(chunk.source_id) ?? [];
      current.push(chunk);
      chunksBySource.set(chunk.source_id, current);
    }
  }

  let sourceSnapshots: Array<Record<string, unknown>>;

  try {
    sourceSnapshots = selectedSources.map((source) => {
      const contentText =
        source.source_type === "file"
          ? buildContentFromKnowledgeChunks(chunksBySource.get(source.id) ?? [])
          : source.raw_text?.trim() ?? "";

      if (!contentText) {
        throw new Error(
          `Knowledge source "${source.name}" has no readable content. Process it before publishing.`,
        );
      }

      return {
        original_source_id: source.id,
        original_source_type: source.source_type,
        source_name: source.name,
        source_description: source.description,
        content_text: contentText,
        mime_type:
          source.source_type === "file"
            ? "text/plain"
            : source.source_type === "website"
              ? "text/markdown"
              : source.mime_type,
        file_size_bytes: Buffer.byteLength(contentText, "utf8"),
        metadata: {
          originalMimeType: source.mime_type,
          originalFileSizeBytes: source.file_size_bytes,
          originalMetadata: source.metadata,
        },
      };
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to snapshot knowledge.",
      400,
    );
  }

  const sanitizedDefinition = sanitizeBuilderDefinitionForTemplate(definition);
  const templateInsert = {
    source_agent_id: agentRecord.id,
    source_workspace_id: agentRecord.workspace_id,
    submitted_by: user.id,
    status: "pending",
    name: agentRecord.name,
    slug: buildTemplateSlug(agentRecord.name),
    description: agentRecord.description,
    surface: agentRecord.surface,
    model: agentRecord.model,
    instructions: agentRecord.instructions,
    starter_prompts: agentRecord.starter_prompts,
    timezone: agentRecord.timezone,
    definition: sanitizedDefinition,
    required_integrations: getRequiredIntegrationsFromDefinition(sanitizedDefinition),
    knowledge_source_count: sourceSnapshots.length,
  };

  try {
    const { data: template, error: templateError } = await admin
      .from("agent_library_templates")
      .insert(templateInsert)
      .select()
      .single();

    if (templateError || !template) {
      return errorResponse(
        templateError?.message ?? "Failed to submit template.",
        500,
      );
    }

    if (sourceSnapshots.length > 0) {
      const { error: sourcesError } = await admin
        .from("agent_library_template_sources")
        .insert(
          sourceSnapshots.map((source) => ({
            ...source,
            template_id: template.id,
          })),
        );

      if (sourcesError) {
        await admin.from("agent_library_templates").delete().eq("id", template.id);
        return errorResponse(sourcesError.message, 500);
      }
    }

    return successResponse({ template });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to submit template.",
      500,
    );
  }
}
