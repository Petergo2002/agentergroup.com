import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPublicWidgetRateLimitContext,
  buildRateLimitErrorPayload,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
} from "@/lib/rate-limit";
import { createClientSafeError } from "@/lib/server-errors";
import {
  buildWidgetRuntimeCorsHeaders,
  loadWidgetByPublicKey,
  loadWidgetSession,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
];

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

  try {
    if (!runtimeOrigin.ok) {
      return buildErrorResponse(
        request,
        runtimeOrigin.status,
        runtimeOrigin.error,
        runtimeOrigin.code,
      );
    }

    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      loaded.widget,
      request,
    );

    const access = await resolveWidgetRuntimeAccess({
      request,
      widget: loaded.widget,
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

    if (access.source !== "preview" && loaded.widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return buildErrorResponse(request, 400, "Invalid form data.");
    }

    const sessionId = formData.get("sessionId");
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return buildErrorResponse(request, 400, "sessionId is required.");
    }

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "chat", // use the chat limit for uploads as well, or we could create a new rule
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: loaded.widget.id,
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
      loaded.widget.id,
      sessionId,
    );

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

    if (file.size > MAX_FILE_SIZE) {
      return buildErrorResponse(request, 400, "File size exceeds 5MB limit.");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return buildErrorResponse(request, 400, "File type is not supported.");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${loaded.widget.id}/${sessionId}/${crypto.randomUUID()}_${safeName}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("widget-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("widget-attachments")
      .getPublicUrl(storagePath);

    // ─── Ephemeral Knowledge Indexing (Industry Standard RAG) ─────────────────
    // If the uploaded file is a document (PDF, Text), we create an ephemeral 
    // knowledge source record so the Edge Function can index it for the agent 
    // to "read" during the current session.
    if (file.type === 'application/pdf' || file.type === 'text/plain') {
      try {
        const { data: source, error: sourceError } = await supabase
          .from('knowledge_sources')
          .insert({
            workspace_id: loaded.widget.workspace_id,
            name: file.name,
            source_type: 'file',
            status: 'pending',
            storage_bucket: 'widget-attachments',
            storage_path: storagePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            widget_session_id: sessionId,
            metadata: {
              sessionId,
              widgetId: loaded.widget.id,
              ephemeral: true
            }
          })
          .select('id')
          .single();

        if (source && !sourceError) {
          // Trigger the Edge Function to index the document immediately.
          // We don't await this as it can run in the background.
          void supabase.functions.invoke('process-knowledge-source', {
            body: { sourceId: source.id }
          });
        }
      } catch (err) {
        console.error('[upload] Failed to create ephemeral knowledge source:', err);
        // We don't fail the upload if indexing fails — the URL is still available
      }
    }

    return Response.json(
      {
        url: publicUrlData.publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      },
      { headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  } catch (error) {
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
