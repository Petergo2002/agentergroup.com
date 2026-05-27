import { Buffer } from "node:buffer";
import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  KNOWLEDGE_BUCKET,
  getSupportedKnowledgeFileTypesLabel,
  inferKnowledgeMimeType,
  isSupportedKnowledgeMimeType,
} from "@/lib/knowledge";
import type { KnowledgeSourceRecord, KnowledgeSourceType } from "@/lib/types";

const DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const KNOWLEDGE_SOURCE_LIST_SELECT =
  "id, workspace_id, created_by, name, description, source_type, status, storage_bucket, storage_path, mime_type, file_size_bytes, chunk_count, last_processed_at, error_message, metadata, created_at, updated_at";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

function buildStorageLimitError(storageLimitBytes: number) {
  return `Storage limit exceeded. Your current plan allows ${
    storageLimitBytes / 1024 / 1024
  }MB total knowledge base storage.`;
}

async function linkSourceToFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  sourceId: string,
  folderIdValue: unknown,
) {
  const folderId = typeof folderIdValue === "string" ? folderIdValue.trim() : "";

  if (!folderId) {
    return;
  }

  const { data: folder, error: folderError } = await supabase
    .from("knowledge_folders")
    .select("id")
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (folderError) {
    throw new Error(folderError.message);
  }

  if (!folder) {
    throw new Error("Target folder was not found.");
  }

  const { error: linkError } = await supabase
    .from("knowledge_folder_sources")
    .insert({
      folder_id: folder.id,
      knowledge_source_id: sourceId,
    });

  if (linkError && linkError.code !== "23505") {
    throw new Error(linkError.message);
  }
}

function queueKnowledgeProcessing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string,
  accessToken?: string | null,
) {
  after(async () => {
    const processResponse = await supabase.functions.invoke(
      "process-knowledge-source",
      {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
        body: {
          sourceId,
        },
      },
    );

    if (processResponse.error) {
      const { data: failedSource } = await supabase
        .from("knowledge_sources")
        .select("error_message")
        .eq("id", sourceId)
        .maybeSingle();

      const errorMessage =
        failedSource?.error_message ??
        processResponse.error.message ??
        "Knowledge processing failed.";

      console.error("[knowledge/sources] Background processing failed", {
        sourceId,
        message: errorMessage,
      });

      await supabase
        .from("knowledge_sources")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", sourceId);
    }
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select(KNOWLEDGE_SOURCE_LIST_SELECT)
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sources: (data ?? []) as KnowledgeSourceRecord[],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const sourceType = String(body.sourceType ?? "").trim() as KnowledgeSourceType;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  if (!["text", "file", "website"].includes(sourceType)) {
    return NextResponse.json({ error: "sourceType must be text, file, or website." }, { status: 400 });
  }

  // Calculate current storage usage
  const { data: usageData, error: usageError } = await supabase
    .from("knowledge_sources")
    .select("file_size_bytes")
    .eq("workspace_id", context.workspace.id);

  if (usageError) {
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }

  const currentTotalBytes = (usageData ?? []).reduce(
    (acc, curr) => acc + (curr.file_size_bytes ?? 0),
    0,
  );
  const storageLimit =
    context.subscription?.storage_limit_bytes ??
    DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES;

  if (sourceType === "text") {
    const rawText = String(body.rawText ?? "").trim();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required for text sources." }, { status: 400 });
    }

    const newSizeBytes = Buffer.byteLength(rawText, "utf8");
    if (currentTotalBytes + newSizeBytes > storageLimit) {
      return NextResponse.json(
        { error: buildStorageLimitError(storageLimit) },
        { status: 402 },
      );
    }

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
        source_type: "text",
        raw_text: rawText,
        file_size_bytes: newSizeBytes,
        status: "pending",
      })
      .select()
      .single();

    if (error || !source) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create knowledge source." },
        { status: 500 },
      );
    }

    try {
      await linkSourceToFolder(supabase, context.workspace.id, source.id, body.folderId);
    } catch (folderError) {
      return NextResponse.json(
        {
          error:
            folderError instanceof Error
              ? folderError.message
              : "Failed to add source to folder.",
        },
        { status: 500 },
      );
    }

    const processResponse = await supabase.functions.invoke(
      "process-knowledge-source",
      {
        headers: session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`,
            }
          : undefined,
        body: {
          sourceId: source.id,
        },
      },
    );

    if (processResponse.error) {
      return NextResponse.json(
        {
          error: processResponse.error.message,
          source,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      source,
      processStatus: "processing",
    });
  }

  if (sourceType === "website") {
    let url = String(body.url ?? "").trim();

    if (!url) {
      return NextResponse.json({ error: "url is required for website sources." }, { status: 400 });
    }

    // Prepend https:// if no protocol is provided
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL provided." }, { status: 400 });
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      return NextResponse.json({ error: "FIRECRAWL_API_KEY is not configured." }, { status: 500 });
    }

    const isPremium = context.subscription?.plan_tier === "premium";
    const requestedLimit = Math.min(Math.max(Number(body.limit ?? 1), 1), 30);
    const crawlLimit = isPremium ? requestedLimit : 1;
    const selectedUrls = Array.isArray(body.urls) ? (body.urls as unknown[]).filter((u): u is string => typeof u === "string").slice(0, 30) : [];

    // Create the source immediately without waiting for Firecrawl
    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
        source_type: "website",
        raw_text: "", // Will be filled by the edge function
        file_size_bytes: 0,
        status: "pending",
        metadata: { 
          sourceUrl: url,
          crawlLimit,
          selectedUrls,
          isPremium 
        },
      })
      .select()
      .single();

    if (error || !source) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create knowledge source." },
        { status: 500 },
      );
    }

    try {
      await linkSourceToFolder(supabase, context.workspace.id, source.id, body.folderId);
    } catch (folderError) {
      return NextResponse.json(
        {
          error:
            folderError instanceof Error
              ? folderError.message
              : "Failed to add source to folder.",
        },
        { status: 500 },
      );
    }

    queueKnowledgeProcessing(supabase, source.id, session?.access_token);

    return NextResponse.json({
      source,
      processStatus: "queued",
    });
  }

  const fileName = String(body.fileName ?? "").trim();
  const mimeType = inferKnowledgeMimeType(
    fileName,
    String(body.mimeType ?? "").trim(),
  );
  const fileSizeBytes = Number(body.fileSizeBytes ?? 0);

  if (!fileName || !mimeType || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return NextResponse.json(
      { error: "fileName, mimeType, and fileSizeBytes are required for file sources." },
      { status: 400 },
    );
  }

  if (!isSupportedKnowledgeMimeType(mimeType)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${mimeType}. Supported types are ${getSupportedKnowledgeFileTypesLabel()}.`,
      },
      { status: 400 },
    );
  }

  if (currentTotalBytes + fileSizeBytes > storageLimit) {
    return NextResponse.json(
      { error: buildStorageLimitError(storageLimit) },
      { status: 402 },
    );
  }

  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .insert({
      workspace_id: context.workspace.id,
      created_by: user.id,
      name,
      description,
      source_type: "file",
      status: "pending",
      storage_bucket: KNOWLEDGE_BUCKET,
      storage_path: "",
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
    })
    .select()
    .single();

  if (error || !source) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create knowledge source." },
      { status: 500 },
    );
  }

  const storagePath = `${context.workspace.id}/${source.id}/${sanitizeFileName(fileName)}`;
  const { data: updatedSource, error: updateError } = await supabase
    .from("knowledge_sources")
    .update({
      storage_path: storagePath,
    })
    .eq("id", source.id)
    .select()
    .single();

  if (updateError || !updatedSource) {
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to reserve upload path." },
      { status: 500 },
    );
  }

  try {
    await linkSourceToFolder(supabase, context.workspace.id, updatedSource.id, body.folderId);
  } catch (folderError) {
    return NextResponse.json(
      {
        error:
          folderError instanceof Error
            ? folderError.message
            : "Failed to add source to folder.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    source: updatedSource,
    upload: {
      bucket: KNOWLEDGE_BUCKET,
      path: storagePath,
    },
  });
}
