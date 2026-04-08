import { NextRequest, NextResponse } from "next/server";
import {
  hasInternalAssistantsEnabled,
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
} from "@/lib/assistants/feature-flags";
import {
  extractPdfDownloadsFromAssistantMetadata,
  extractPdfDownloadsFromToolMessage,
  sanitizeAssistantDownloadFilename,
} from "@/lib/assistants/downloads";
import { loadAssistantById, loadAssistantThread } from "@/lib/assistants/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { SafeFetchError, fetchSafeRemoteResource } from "@/lib/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface StoredToolMessageRow {
  id: string;
  thread_id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  metadata: Record<string, unknown> | null;
  tool_name: string | null;
}

function buildAttachmentDisposition(filename: string) {
  return `attachment; filename="${filename.replace(/"/g, "")}"`;
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; messageId: string }>;
  },
) {
  const { id, messageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);

    if (!hasInternalAssistantsEnabled(context.workspace)) {
      return NextResponse.json(
        {
          error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
          code: INTERNAL_ASSISTANTS_DISABLED_CODE,
        },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const assistant = await loadAssistantById(admin as never, id, context.workspace.id);

    if (!assistant || assistant.archived_at || assistant.status === "draft") {
      return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
    }

    const { data: message, error } = await admin
      .from("messages")
      .select("id, thread_id, role, content, metadata, tool_name")
      .eq("id", messageId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const toolMessage = (message ?? null) as StoredToolMessageRow | null;

    if (!toolMessage || !["tool", "assistant"].includes(toolMessage.role)) {
      return NextResponse.json({ error: "Download not found." }, { status: 404 });
    }

    const thread = await loadAssistantThread(admin as never, {
      threadId: toolMessage.thread_id,
      assistantId: assistant.id,
      workspaceId: assistant.workspace_id,
    });

    if (!thread) {
      return NextResponse.json({ error: "Download not found." }, { status: 404 });
    }

    const requestedIndex = Number.parseInt(
      request.nextUrl.searchParams.get("index") ?? "0",
      10,
    );
    const downloadIndex = Number.isFinite(requestedIndex) && requestedIndex >= 0
      ? requestedIndex
      : 0;
    const downloads =
      toolMessage.role === "tool"
        ? extractPdfDownloadsFromToolMessage({
            content: toolMessage.content,
            metadata: toolMessage.metadata,
            toolName: toolMessage.tool_name,
          })
        : extractPdfDownloadsFromAssistantMetadata(toolMessage.metadata);
    const download = downloads[downloadIndex] ?? null;

    if (!download) {
      return NextResponse.json({ error: "Download not found." }, { status: 404 });
    }

    if (download.embeddedDataBase64) {
      const buffer = Buffer.from(download.embeddedDataBase64, "base64");
      const filename = sanitizeAssistantDownloadFilename(download.filename);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": download.mimeType || "application/pdf",
          "Content-Disposition": buildAttachmentDisposition(filename),
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    let upstream: Response;

    try {
      upstream = await fetchSafeRemoteResource(download.url, {
        method: "GET",
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof SafeFetchError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      throw error;
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Failed to fetch the generated PDF." },
        { status: 502 },
      );
    }

    const filename = sanitizeAssistantDownloadFilename(download.filename);
    const headers = new Headers();

    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || download.mimeType || "application/pdf",
    );
    headers.set("Content-Disposition", buildAttachmentDisposition(filename));
    headers.set("Cache-Control", "private, no-store, max-age=0");

    const contentLength = upstream.headers.get("content-length");

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to download the generated PDF.",
      },
      { status: 500 },
    );
  }
}
