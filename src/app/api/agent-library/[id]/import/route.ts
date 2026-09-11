import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import {
  applyImportedKnowledgeSourceIds,
  buildImportedAgentSlug,
} from "@/lib/agent-library";
import { hasAutomationsEnabled, hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
import { resolveTemplateVariables } from "@/lib/template-variables";
import { MAX_KNOWLEDGE_TEXT_SOURCE_BYTES } from "@/lib/knowledge-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
  BuilderDefinition,
} from "@/lib/types";
import { getVerifiedApiIdentity } from "@/lib/app/api-auth";

const DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;

type TemplateJoinRow = AgentLibraryTemplateRecord & {
  sources?: AgentLibraryTemplateSourceRecord[];
};

function buildStorageLimitError(storageLimitBytes: number) {
  return `Storage limit exceeded. Your current plan allows ${
    storageLimitBytes / 1024 / 1024
  }MB total knowledge base storage.`;
}

async function cleanupImportedAgent(admin: ReturnType<typeof createAdminClient>, agentId: string | null) {
  if (agentId) {
    await admin.from("agents").delete().eq("id", agentId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Read optional variable values from the request body
  const body = await request.json().catch(() => ({}));
  const variableValues: Record<string, string> = body.variableValues ?? {};

  const supabase = await createClient();
  const admin = createAdminClient();
  const { user, session } = await getVerifiedApiIdentity(supabase);

  if (!user || !session?.access_token) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data: template, error: templateError } = await supabase
    .from("agent_library_templates")
    .select("*, sources:agent_library_template_sources(*)")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (templateError) {
    return errorResponse(templateError.message, 500);
  }

  if (!template) {
    return errorResponse("Template not found.", 404);
  }

  const templateRecord = template as unknown as TemplateJoinRow;
  if (
    context.workspace.product_experience === "milo" &&
    templateRecord.surface === "widget"
  ) {
    return errorResponse("This workspace already has Milo.", 409);
  }
  if (templateRecord.surface === "assistant" && !hasInternalAssistantsEnabled(context.workspace)) {
    return errorResponse("Internal assistants are not enabled for this workspace.", 403);
  }

  if (templateRecord.surface === "automation" && !hasAutomationsEnabled(context.workspace)) {
    return errorResponse("Automations are not enabled for this workspace.", 403);
  }

  const { count, error: countError } = await supabase
    .from("agents")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", context.workspace.id)
    .is("archived_at", null);

  if (countError) {
    return errorResponse(countError.message, 500);
  }

  if ((count ?? 0) >= (context.subscription?.agents_limit ?? 1)) {
    return errorResponse("You have reached your agent limit. Please upgrade your plan.", 402);
  }

  const sources = templateRecord.sources ?? [];
  const incomingBytes = sources.reduce(
    (total, source) => total + Buffer.byteLength(source.content_text, "utf8"),
    0,
  );
  const { data: usageData, error: usageError } = await supabase
    .from("knowledge_sources")
    .select("file_size_bytes")
    .eq("workspace_id", context.workspace.id);

  if (usageError) {
    return errorResponse(usageError.message, 500);
  }

  const currentBytes = (usageData ?? []).reduce(
    (total, row) => total + (row.file_size_bytes ?? 0),
    0,
  );
  const storageLimit =
    context.subscription?.storage_limit_bytes ??
    DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES;

  if (currentBytes + incomingBytes > storageLimit) {
    return errorResponse(buildStorageLimitError(storageLimit), 402);
  }

  let createdAgentId: string | null = null;

  try {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name: templateRecord.name,
        slug: buildImportedAgentSlug(templateRecord.name),
        description: templateRecord.description,
        status: "draft",
        surface: templateRecord.surface,
        model: templateRecord.model,
        // Resolve any {{variable}} tokens before saving to the live agent
        instructions: resolveTemplateVariables(templateRecord.instructions, variableValues),
        starter_prompts: templateRecord.starter_prompts,
        timezone: templateRecord.timezone,
      })
      .select()
      .single();

    if (agentError || !agent) {
      throw agentError ?? new Error("Failed to create imported agent.");
    }

    createdAgentId = agent.id;
    const importedSourceIds: string[] = [];
    const processWarnings: string[] = [];

    for (const source of sources) {
      const sourceSizeBytes = Buffer.byteLength(source.content_text, "utf8");
      if (sourceSizeBytes > MAX_KNOWLEDGE_TEXT_SOURCE_BYTES) {
        throw new Error("Imported text knowledge sources are limited to 1MB each.");
      }

      const { data: importedSource, error: sourceError } = await admin
        .from("knowledge_sources")
        .insert({
          workspace_id: context.workspace.id,
          created_by: user.id,
          name: source.source_name,
          description: source.source_description,
          source_type: "text",
          raw_text: source.content_text,
          file_size_bytes: 0,
          status: "pending",
          metadata: {
            agentLibraryTemplateId: templateRecord.id,
            agentLibraryTemplateSourceId: source.id,
            originalSourceType: source.original_source_type,
            importedFromAgentLibrary: true,
          },
        })
        .select()
        .single();

      if (sourceError || !importedSource) {
        throw sourceError ?? new Error("Failed to clone template knowledge.");
      }

      const reservationResult = await admin.rpc(
        "reserve_knowledge_source_storage",
        {
          p_workspace_id: context.workspace.id,
          p_source_id: importedSource.id,
          p_size_bytes: sourceSizeBytes,
        },
      );

      if (reservationResult.error) {
        await admin.from("knowledge_sources").delete().eq("id", importedSource.id);
        throw new Error(
          reservationResult.error.message.includes(
            "KNOWLEDGE_STORAGE_LIMIT_EXCEEDED",
          )
            ? buildStorageLimitError(storageLimit)
            : "Failed to reserve imported knowledge storage.",
        );
      }

      importedSource.file_size_bytes = sourceSizeBytes;

      importedSourceIds.push(importedSource.id);

      const processResponse = await supabase.functions.invoke("process-knowledge-source", {
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : undefined,
        body: {
          sourceId: importedSource.id,
        },
      });

      if (processResponse.error) {
        processWarnings.push(processResponse.error.message);
      }
    }

    if (importedSourceIds.length > 0) {
      const { error: linkError } = await supabase
        .from("agent_knowledge_sources")
        .insert(
          importedSourceIds.map((sourceId) => ({
            agent_id: agent.id,
            knowledge_source_id: sourceId,
          })),
        );

      if (linkError) {
        throw linkError;
      }
    }

    const definition = applyImportedKnowledgeSourceIds(
      templateRecord.definition as BuilderDefinition,
      importedSourceIds,
    );
    const { error: draftError } = await supabase.from("agent_drafts").insert({
      agent_id: agent.id,
      workspace_id: context.workspace.id,
      updated_by: user.id,
      definition,
    });

    if (draftError) {
      throw draftError;
    }

    return successResponse({
      agent,
      processWarnings,
    });
  } catch (error) {
    await cleanupImportedAgent(admin, createdAgentId);
    const message =
      error instanceof Error ? error.message : "Failed to import template.";
    const agentLimitReached = message.includes("AGENT_LIMIT_REACHED");
    return errorResponse(
      agentLimitReached
        ? "You have reached your agent limit. Please upgrade your plan."
        : message,
      agentLimitReached ? 402 : 500,
    );
  }
}
