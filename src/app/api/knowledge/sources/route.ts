import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  InvalidJsonBodyError,
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/bounded-json";
import {
  KNOWLEDGE_BUCKET,
  getSupportedKnowledgeFileTypesLabel,
  inferKnowledgeMimeType,
  isSupportedKnowledgeMimeType,
} from "@/lib/knowledge";
import {
  MAX_KNOWLEDGE_TEXT_REQUEST_BYTES,
  validateKnowledgeText,
} from "@/lib/knowledge-text";
import {
  MAX_WEBSITE_KNOWLEDGE_PAGES,
  normalizeSelectedWebsiteUrls,
  normalizeWebsiteKnowledgeUrl,
} from "@/lib/knowledge-website";
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

function isKnowledgeStorageLimitError(error: unknown) {
  return getErrorMessage(error).includes("KNOWLEDGE_STORAGE_LIMIT_EXCEEDED");
}

async function reserveKnowledgeStorage(
  workspaceId: string,
  sourceId: string,
  sizeBytes: number,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("reserve_knowledge_source_storage", {
    p_workspace_id: workspaceId,
    p_source_id: sourceId,
    p_size_bytes: sizeBytes,
  });

  if (error) {
    throw error;
  }
}

async function deleteKnowledgeSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string,
) {
  const { error } = await supabase
    .from("knowledge_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    console.error("Failed to clean up knowledge source after error.", error);
  }
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
    const admin = createAdminClient();
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

      await admin
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
    .is("widget_session_id", null)
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

  if (!user || !session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();
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

  const body = bodyValue as Record<string, unknown>;
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
    .eq("workspace_id", context.workspace.id)
    .is("widget_session_id", null);

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
    const textValidation = validateKnowledgeText(
      typeof body.rawText === "string" ? body.rawText.trim() : body.rawText,
    );

    if (!textValidation.valid) {
      return NextResponse.json(
        { error: textValidation.error },
        { status: textValidation.code === "too_large" ? 413 : 400 },
      );
    }

    const rawText = textValidation.text;
    const newSizeBytes = textValidation.sizeBytes;
    if (currentTotalBytes + newSizeBytes > storageLimit) {
      return NextResponse.json(
        { error: buildStorageLimitError(storageLimit) },
        { status: 402 },
      );
    }

    const { data: source, error } = await admin
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
        source_type: "text",
        raw_text: rawText,
        file_size_bytes: 0,
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
      await reserveKnowledgeStorage(
        context.workspace.id,
        source.id,
        newSizeBytes,
      );
      source.file_size_bytes = newSizeBytes;
    } catch (reserveError) {
      await deleteKnowledgeSource(supabase, source.id);

      if (!isKnowledgeStorageLimitError(reserveError)) {
        console.error("Failed to reserve knowledge storage.", reserveError);
        return NextResponse.json(
          { error: "Failed to reserve knowledge storage." },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: buildStorageLimitError(storageLimit) },
        { status: 402 },
      );
    }

    try {
      await linkSourceToFolder(supabase, context.workspace.id, source.id, body.folderId);
    } catch (folderError) {
      await deleteKnowledgeSource(supabase, source.id);
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
    const rawUrl = String(body.url ?? "").trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "url is required for website sources." }, { status: 400 });
    }

    let websiteUrl: URL;
    try {
      websiteUrl = normalizeWebsiteKnowledgeUrl(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL provided." }, { status: 400 });
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      return NextResponse.json({ error: "FIRECRAWL_API_KEY is not configured." }, { status: 500 });
    }

    const isPremium = context.subscription?.plan_tier === "premium";
    const requestedLimit = Math.min(
      Math.max(Number(body.limit ?? 1), 1),
      MAX_WEBSITE_KNOWLEDGE_PAGES,
    );
    const crawlLimit = isPremium ? requestedLimit : 1;
    let selectedUrls: string[];

    try {
      selectedUrls = normalizeSelectedWebsiteUrls(websiteUrl, body.urls);
    } catch (selectedUrlError) {
      return NextResponse.json(
        {
          error:
            selectedUrlError instanceof Error
              ? selectedUrlError.message
              : "Selected URLs are invalid.",
        },
        { status: 400 },
      );
    }

    if (!isPremium && selectedUrls.length > 0) {
      return NextResponse.json(
        { error: "Selecting multiple website pages is a Premium feature." },
        { status: 403 },
      );
    }

    // Create the source immediately without waiting for Firecrawl
    const { data: source, error } = await admin
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
          sourceUrl: websiteUrl.toString(),
          crawlLimit,
          selectedUrls,
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
      await deleteKnowledgeSource(supabase, source.id);
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

  const { data: source, error } = await admin
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
      file_size_bytes: 0,
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
    await reserveKnowledgeStorage(
      context.workspace.id,
      source.id,
      fileSizeBytes,
    );
    source.file_size_bytes = fileSizeBytes;
  } catch (reserveError) {
    await deleteKnowledgeSource(supabase, source.id);

    if (!isKnowledgeStorageLimitError(reserveError)) {
      console.error("Failed to reserve knowledge storage.", reserveError);
      return NextResponse.json(
        { error: "Failed to reserve knowledge storage." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: buildStorageLimitError(storageLimit) },
      { status: 402 },
    );
  }

  const storagePath = `${context.workspace.id}/${source.id}/${sanitizeFileName(fileName)}`;
  const { data: updatedSource, error: updateError } = await admin
    .from("knowledge_sources")
    .update({
      storage_path: storagePath,
    })
    .eq("id", source.id)
    .eq("workspace_id", context.workspace.id)
    .select()
    .single();

  if (updateError || !updatedSource) {
    await deleteKnowledgeSource(supabase, source.id);
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to reserve upload path." },
      { status: 500 },
    );
  }

  try {
    await linkSourceToFolder(supabase, context.workspace.id, updatedSource.id, body.folderId);
  } catch (folderError) {
    await deleteKnowledgeSource(supabase, updatedSource.id);
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
