import { NextRequest } from "next/server";
import {
  buildPublicWidgetRateLimitContext,
  buildRateLimitErrorPayload,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
} from "@/lib/rate-limit";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inspectWidgetAttachment,
  MAX_WIDGET_ATTACHMENT_BYTES_PER_SESSION,
  MAX_WIDGET_ATTACHMENTS_PER_SESSION,
  sanitizeWidgetAttachmentName,
} from "@/lib/widget-attachments";
import {
  buildWidgetRuntimeCorsHeaders,
  loadWidgetRecordByPublicKey,
  loadWidgetSession,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  upsertWidgetSession,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";
import {
  canAccessWidgetSession,
  hashWidgetVisitorToken,
  readWidgetVisitorToken,
} from "@/lib/widgets/visitor";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
) {
  return Response.json(
    code ? { error, code } : { error },
    { status, headers: buildWidgetRuntimeCorsHeaders(request) },
  );
}

function buildRateLimitedResponse(
  request: NextRequest,
  error: string,
  code: string,
  retryAfterSeconds: number,
) {
  return Response.json(
    {
      error,
      code,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...buildWidgetRuntimeCorsHeaders(request),
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function OPTIONS(request: NextRequest) {
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  if (!runtimeOrigin.ok) {
    return buildErrorResponse(
      request,
      runtimeOrigin.status,
      runtimeOrigin.error,
      runtimeOrigin.code,
    );
  }

  return new Response(null, {
    status: 204,
    headers: buildWidgetRuntimeCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);
  let uploadedStoragePath: string | null = null;
  let insertedAttachmentId: string | null = null;

  try {
    if (!runtimeOrigin.ok) {
      return buildErrorResponse(
        request,
        runtimeOrigin.status,
        runtimeOrigin.error,
        runtimeOrigin.code,
      );
    }

    const widget = await loadWidgetRecordByPublicKey(supabase, widgetPublicKey);

    if (!widget) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      widget,
      request,
    );
    const access = await resolveWidgetRuntimeAccess({
      request,
      widget,
      preview,
    });

    if (!access.ok) {
      return buildErrorResponse(
        request,
        access.status,
        access.error,
        access.code,
      );
    }

    if (access.source !== "preview" && widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return buildErrorResponse(request, 400, "Invalid form data.");
    }

    const rawSessionId = formData.get("sessionId");
    const sessionId =
      typeof rawSessionId === "string" ? rawSessionId.trim() : "";

    if (!sessionId) {
      return buildErrorResponse(request, 400, "sessionId is required.");
    }

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "uploads",
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: widget.id,
            sessionId,
          }),
        ),
      );

      if (!rateLimitDecision.allowed) {
        const payload = buildRateLimitErrorPayload(rateLimitDecision);
        return buildRateLimitedResponse(
          request,
          payload.error,
          payload.code,
          payload.retryAfterSeconds,
        );
      }
    }

    const existingSession = await loadWidgetSession(
      supabase,
      widget.id,
      sessionId,
    );
    // Builder previews are bound to the visitor capability too, so the preview
    // surface gets the same real conversation history as a live visitor.
    const visitorToken = readWidgetVisitorToken(request);
    const visitorTokenHash = visitorToken
      ? hashWidgetVisitorToken(widget.id, visitorToken)
      : null;

    if (
      existingSession &&
      !canAccessWidgetSession(existingSession.visitor_token_hash, visitorTokenHash)
    ) {
      return buildErrorResponse(
        request,
        403,
        "This chat belongs to a different browser session.",
        "CONVERSATION_ACCESS_DENIED",
      );
    }

    if (existingSession?.status === "completed") {
      return buildErrorResponse(
        request,
        409,
        "This chat has already ended. Start a new chat to continue.",
        "SESSION_COMPLETED",
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file !== "object" || !file.name) {
      return buildErrorResponse(request, 400, "File is required.");
    }

    const fileBuffer = await file.arrayBuffer();
    let inspectedFile: ReturnType<typeof inspectWidgetAttachment>;

    try {
      inspectedFile = inspectWidgetAttachment(
        new Uint8Array(fileBuffer),
        file.name,
        file.type,
      );
    } catch (validationError) {
      return buildErrorResponse(
        request,
        400,
        validationError instanceof Error
          ? validationError.message
          : "File type is not supported.",
      );
    }

    const widgetSession =
      existingSession ??
      (await upsertWidgetSession(supabase, {
        widgetId: widget.id,
        sessionId,
        source: access.source,
        origin: access.origin,
        visitorTokenHash,
      }));
    const { data: existingAttachments, error: existingAttachmentsError } =
      await supabase
        .from("widget_attachments")
        .select<{ id: string; file_size_bytes: number }>(
          "id, file_size_bytes",
        )
        .eq("widget_session_id", widgetSession.id);

    if (existingAttachmentsError) {
      throw new Error(
        `Failed to check upload quota: ${existingAttachmentsError.message}`,
      );
    }

    const attachmentRows = (existingAttachments ?? []) as Array<{
      id: string;
      file_size_bytes: number;
    }>;
    const existingBytes = attachmentRows.reduce(
      (total, attachment) => total + attachment.file_size_bytes,
      0,
    );

    if (
      attachmentRows.length >= MAX_WIDGET_ATTACHMENTS_PER_SESSION ||
      existingBytes + file.size > MAX_WIDGET_ATTACHMENT_BYTES_PER_SESSION
    ) {
      return buildErrorResponse(
        request,
        429,
        "This chat has reached its file upload quota.",
        "UPLOAD_QUOTA_EXCEEDED",
      );
    }

    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeWidgetAttachmentName(file.name);
    const storagePath = `${widget.workspace_id}/${widget.id}/${widgetSession.id}/${attachmentId}/${safeName}`;
    uploadedStoragePath = storagePath;

    const { error: uploadError } = await supabase.storage
      .from("widget-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: inspectedFile.mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("widget_attachments")
      .insert({
        id: attachmentId,
        workspace_id: widget.workspace_id,
        widget_id: widget.id,
        widget_session_id: widgetSession.id,
        storage_bucket: "widget-attachments",
        storage_path: storagePath,
        original_name: file.name,
        mime_type: inspectedFile.mimeType,
        file_size_bytes: file.size,
      })
      .select("id")
      .single();

    if (attachmentError || !attachment) {
      throw new Error(
        attachmentError?.message ?? "Failed to record uploaded file.",
      );
    }

    insertedAttachmentId = attachmentId;

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("widget-attachments")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(
        signedUrlError?.message ?? "Failed to create a secure file URL.",
      );
    }

    if (
      inspectedFile.mimeType === "application/pdf" ||
      inspectedFile.mimeType === "text/plain"
    ) {
      try {
        const workspaceResult = await supabase
          .from("workspaces")
          .select("owner_id")
          .eq("id", widget.workspace_id)
          .maybeSingle();
        const workspaceOwner = workspaceResult.data as
          | { owner_id: string | null }
          | null;

        if (workspaceResult.error || !workspaceOwner?.owner_id) {
          throw new Error(
            workspaceResult.error?.message ||
              "Could not resolve the workspace owner for ephemeral knowledge.",
          );
        }

        const { data: source, error: sourceError } = await supabase
          .from("knowledge_sources")
          .insert({
            workspace_id: widget.workspace_id,
            created_by: workspaceOwner.owner_id,
            name: file.name,
            description: "",
            source_type: "file",
            status: "pending",
            storage_bucket: "widget-attachments",
            storage_path: storagePath,
            mime_type: inspectedFile.mimeType,
            file_size_bytes: file.size,
            widget_session_id: widgetSession.id,
            metadata: {
              sessionId,
              widgetId: widget.id,
              attachmentId,
              ephemeral: true,
            },
          })
          .select("id")
          .single();

        if (sourceError || !source) {
          throw sourceError ?? new Error("Failed to index the uploaded file.");
        }

        const typedSource = source as { id: string };
        void createAdminClient().functions.invoke("process-knowledge-source", {
          body: { sourceId: typedSource.id },
        });
      } catch (indexingError) {
        console.error(
          "[upload] Failed to create ephemeral knowledge source:",
          indexingError,
        );
      }
    }

    return Response.json(
      {
        id: attachmentId,
        url: signedUrlData.signedUrl,
        name: file.name,
        type: inspectedFile.mimeType,
        size: file.size,
      },
      { headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  } catch (error) {
    if (insertedAttachmentId) {
      await supabase
        .from("widget_attachments")
        .delete()
        .eq("id", insertedAttachmentId);
    }

    if (uploadedStoragePath) {
      await supabase.storage
        .from("widget-attachments")
        .remove([uploadedStoragePath]);
    }

    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("WIDGET_ATTACHMENT_COUNT_LIMIT_EXCEEDED") ||
      message.includes("WIDGET_ATTACHMENT_BYTES_LIMIT_EXCEEDED")
    ) {
      return buildErrorResponse(
        request,
        429,
        "This chat has reached its file upload quota.",
        "UPLOAD_QUOTA_EXCEEDED",
      );
    }

    const safeError = createClientSafeError(
      "public widget file upload",
      error,
      "Failed to upload file.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
