import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  getEffectiveConnectionStatus,
  isConnectionScopedToExpectedComposioUser,
} from "@/lib/connections";
import {
  downloadDriveFile,
  getDriveFileMetadata,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import {
  getDriveConnectedAccountId,
  getDriveComposioUserId,
  resolveDriveConnection,
} from "@/lib/drive-connections";
import { KNOWLEDGE_BUCKET } from "@/lib/knowledge";
import { getDriveImportMimeTypes } from "@/lib/integrations";
import { fetchSafeDownloadBytes } from "@/lib/safe-fetch";
import type { ConnectionRecord } from "@/lib/types";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getNestedRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
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

async function getFilePayloadBytes(payload: Record<string, unknown>) {
  try {
    const nestedCandidates = [
      getNestedRecord(payload.downloaded_file_content),
      getNestedRecord(payload.downloadedFileContent),
      getNestedRecord(payload.file),
    ].filter(Boolean) as Record<string, unknown>[];

    const urlCandidates = [
      getString(payload.s3url),
      getString(payload.url),
      getString(payload.file_url),
      ...nestedCandidates.flatMap((candidate) => [
        getString(candidate.s3url),
        getString(candidate.url),
        getString(candidate.file_url),
      ]),
    ].filter(Boolean) as string[];

    for (const url of urlCandidates) {
      try {
        const bytes = await fetchSafeDownloadBytes(url);
        if (bytes) return bytes;
      } catch (err) {
        console.warn("[knowledge/drive/import] Failed to fetch from URL candidate:", url, err);
        continue;
      }
    }

    const inlineContent =
      getString(payload.content) ??
      nestedCandidates.map((candidate) => getString(candidate.content)).find(Boolean) ??
      null;

    if (inlineContent) {
      return new TextEncoder().encode(inlineContent);
    }

    console.error("[knowledge/drive/import] Could not find readable content in payload:", JSON.stringify(payload).slice(0, 500));
    throw new Error("Google Drive download did not return readable file content.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("readable file content")) throw err;
    console.error("[knowledge/drive/import] getFilePayloadBytes error:", err);
    throw new Error("Failed to process Google Drive file content.");
  }
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
  const body = await request.json().catch(() => ({}));
  const fileId = String(body.fileId ?? "").trim();
  const overrideName = String(body.name ?? "").trim();
  const connectionId = String(body.connectionId ?? "").trim();
  const folderId = String(body.folderId ?? "").trim();

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required." }, { status: 400 });
  }

  await syncConnectedAccountsToDatabase(
    supabase as never,
    context.workspace.id,
    user.id,
  );

  const { data, error } = await supabase
    .from("connections")
    .select("id, workspace_id, toolkit_slug, status, external_id, toolkit_data")
    .eq("workspace_id", context.workspace.id)
    .eq("toolkit_slug", "googledrive")
    .order("account_label", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const driveConnections = ((data ?? []) as ConnectionRecord[])
    .filter((connection) => isConnectionScopedToExpectedComposioUser(connection))
    .filter((connection) => getEffectiveConnectionStatus(connection) === "connected");

  try {
    const driveConnection = resolveDriveConnection(driveConnections, connectionId);
    const connectedAccountId = getDriveConnectedAccountId(driveConnection);
    const composioUserId = getDriveComposioUserId(driveConnection);

    if (!connectedAccountId || !composioUserId) {
      throw new Error(
        "Google Drive must be reconnected in this workspace before files can be imported.",
      );
    }

    const metadata = await getDriveFileMetadata(
      composioUserId,
      fileId,
      connectedAccountId,
    );
    const supportedMimeTypes = new Set<string>(getDriveImportMimeTypes());

    if (!supportedMimeTypes.has(metadata.mimeType)) {
      return NextResponse.json(
        { error: `Unsupported Google Drive file type: ${metadata.mimeType}` },
        { status: 400 },
      );
    }

    // Calculate current storage usage
    const { data: usageData, error: usageError } = await supabase
      .from("knowledge_sources")
      .select("file_size_bytes")
      .eq("workspace_id", context.workspace.id);

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500 });
    }

    const currentTotalBytes = (usageData ?? []).reduce((acc, curr) => acc + (curr.file_size_bytes ?? 0), 0);
    const storageLimit = context.subscription?.storage_limit_bytes ?? 10485760; // Default to 10MB

    const isGoogleDoc = metadata.mimeType === "application/vnd.google-apps.document";
    
    const downloadPayload = await downloadDriveFile(
      composioUserId,
      fileId,
      connectedAccountId,
    );

    const fileBytes = await getFilePayloadBytes(downloadPayload);

    if (currentTotalBytes + fileBytes.byteLength > storageLimit) {
      return NextResponse.json(
        { error: `Storage limit exceeded. Your current plan allows ${storageLimit / 1024 / 1024}MB total knowledge base storage.` },
        { status: 402 }
      );
    }

    let fileName = overrideName || metadata.name;
    const finalMimeType = isGoogleDoc ? "application/pdf" : metadata.mimeType;

    if (isGoogleDoc && !fileName.toLowerCase().endsWith(".pdf")) {
      fileName = `${fileName}.pdf`;
    }

    const { data: source, error: sourceError } = await admin
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name: fileName,
        description: isGoogleDoc ? "Imported from Google Drive (Converted to PDF)." : "Imported from Google Drive.",
        source_type: "file",
        status: "pending",
        storage_bucket: KNOWLEDGE_BUCKET,
        storage_path: "",
        mime_type: finalMimeType,
        file_size_bytes: 0,
        metadata: {
          origin: "googledrive",
          drive_file_id: metadata.id,
          drive_mime_type: metadata.mimeType,
          drive_web_view_link: metadata.webViewLink,
          drive_last_modified_at: metadata.modifiedTime,
          is_converted_pdf: isGoogleDoc,
        },
      })
      .select()
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: sourceError?.message ?? "Failed to create the knowledge source." },
        { status: 500 },
      );
    }

    const reservationResult = await admin.rpc("reserve_knowledge_source_storage", {
      p_workspace_id: context.workspace.id,
      p_source_id: source.id,
      p_size_bytes: fileBytes.byteLength,
    });

    if (reservationResult.error) {
      await admin.from("knowledge_sources").delete().eq("id", source.id);

      if (
        reservationResult.error.message.includes(
          "KNOWLEDGE_STORAGE_LIMIT_EXCEEDED",
        )
      ) {
        return NextResponse.json(
          {
            error: `Storage limit exceeded. Your current plan allows ${storageLimit / 1024 / 1024}MB total knowledge base storage.`,
          },
          { status: 402 },
        );
      }

      console.error("[knowledge/drive/import] Storage reservation failed", {
        sourceId: source.id,
        workspaceId: context.workspace.id,
        message: reservationResult.error.message,
      });
      return NextResponse.json(
        { error: "Failed to reserve knowledge storage." },
        { status: 500 },
      );
    }

    source.file_size_bytes = fileBytes.byteLength;

    const storagePath = `${context.workspace.id}/${source.id}/${sanitizeFileName(fileName)}`;
    const uploadResult = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: finalMimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      await admin.from("knowledge_sources").delete().eq("id", source.id);
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from("knowledge_sources")
      .update({
        storage_path: storagePath,
      })
      .eq("id", source.id)
      .eq("workspace_id", context.workspace.id);

    if (updateError) {
      await Promise.all([
        supabase.storage.from(KNOWLEDGE_BUCKET).remove([storagePath]),
        admin.from("knowledge_sources").delete().eq("id", source.id),
      ]);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await linkSourceToFolder(supabase, context.workspace.id, source.id, folderId);

    const processResult = await supabase.functions.invoke("process-knowledge-source", {
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
      body: {
        sourceId: source.id,
      },
    });

    if (processResult.error) {
      return NextResponse.json(
        {
          error: processResult.error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: {
        ...source,
        storage_path: storagePath,
      },
      processStatus: "processing",
    });
  } catch (error) {
    console.error("[knowledge/drive/import] Critical error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import Google Drive file.",
      },
      { status: 500 },
    );
  }
}
