import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  downloadDriveFile,
  getDriveFileMetadata,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import { KNOWLEDGE_BUCKET } from "@/lib/knowledge";
import { getDriveImportMimeTypes } from "@/lib/integrations";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getNestedRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

async function getFilePayloadBytes(payload: Record<string, unknown>) {
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
    const response = await fetch(url);

    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
  }

  const pathCandidates = [
    getString(payload.path),
    getString(payload.filePath),
    ...nestedCandidates.flatMap((candidate) => [
      getString(candidate.path),
      getString(candidate.filePath),
      getString(candidate.file_path),
    ]),
  ].filter(Boolean) as string[];

  for (const path of pathCandidates) {
    try {
      return new Uint8Array(await readFile(path));
    } catch {
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

  throw new Error("Google Drive download did not return readable file content.");
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
  const fileId = String(body.fileId ?? "").trim();
  const overrideName = String(body.name ?? "").trim();

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required." }, { status: 400 });
  }

  const syncedAccounts = await syncConnectedAccountsToDatabase(
    supabase as never,
    context.workspace.id,
    user.id,
  );
  const driveAccount = syncedAccounts.find(
    (account) => account.toolkitSlug === "googledrive" && account.status === "connected",
  );

  if (!driveAccount) {
    return NextResponse.json(
      { error: "Google Drive must be connected before importing files." },
      { status: 400 },
    );
  }

  try {
    const metadata = await getDriveFileMetadata(user.id, fileId);
    const supportedMimeTypes = new Set<string>(getDriveImportMimeTypes());

    if (!supportedMimeTypes.has(metadata.mimeType)) {
      return NextResponse.json(
        { error: `Unsupported Google Drive file type: ${metadata.mimeType}` },
        { status: 400 },
      );
    }

    const downloadPayload = await downloadDriveFile(user.id, fileId);
    const fileBytes = await getFilePayloadBytes(downloadPayload);
    const fileName = overrideName || metadata.name;

    const { data: source, error: sourceError } = await supabase
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name: fileName,
        description: "Imported from Google Drive.",
        source_type: "file",
        status: "pending",
        storage_bucket: KNOWLEDGE_BUCKET,
        storage_path: "",
        mime_type: metadata.mimeType,
        file_size_bytes: fileBytes.byteLength,
        metadata: {
          origin: "googledrive",
          drive_file_id: metadata.id,
          drive_mime_type: metadata.mimeType,
          drive_web_view_link: metadata.webViewLink,
          drive_last_modified_at: metadata.modifiedTime,
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

    const storagePath = `${context.workspace.id}/${source.id}/${sanitizeFileName(metadata.name)}`;
    const uploadResult = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: metadata.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("knowledge_sources")
      .update({
        storage_path: storagePath,
      })
      .eq("id", source.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import Google Drive file.",
      },
      { status: 500 },
    );
  }
}
