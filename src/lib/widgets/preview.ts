import type { NextRequest } from "next/server";
import type {
  WidgetDraftPreviewInput,
  WidgetPreviewDraftRecord,
  WidgetRecord,
} from "@/lib/types";
import type {
  WidgetAdminSupabase,
  WidgetPreviewDraftRow,
} from "./server-types";
import { verifyWidgetPreviewToken } from "./tokens";
import { buildDraftWidgetRuntimeConfig } from "./runtime-config";

export async function createWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    workspaceId: string;
    createdBy: string;
    revision: string;
    payload: WidgetDraftPreviewInput;
    expiresAt: string;
  },
) {
  const { data, error } = await supabase
    .from("widget_preview_drafts")
    .insert({
      widget_id: input.widgetId,
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      revision: input.revision,
      payload: input.payload,
      expires_at: input.expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create widget preview draft.");
  }

  return data as WidgetPreviewDraftRecord;
}

export async function updateWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  input: {
    draftId: string;
    payload: WidgetDraftPreviewInput;
    expiresAt: string;
  },
) {
  const { error } = await supabase
    .from("widget_preview_drafts")
    .update({
      payload: input.payload,
      expires_at: input.expiresAt,
    })
    .eq("id", input.draftId);

  if (error) {
    throw new Error(error.message || "Failed to update widget preview draft.");
  }
}

export async function loadWidgetPreviewDraft(
  supabase: WidgetAdminSupabase,
  widgetId: string,
  revision: string,
) {
  const { data, error } = await supabase
    .from("widget_preview_drafts")
    .select("*")
    .eq("widget_id", widgetId)
    .eq("revision", revision)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const draft = data as WidgetPreviewDraftRow;
  if (new Date(draft.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return draft;
}

export async function resolveWidgetPreviewContext(
  supabase: WidgetAdminSupabase,
  widget: WidgetRecord,
  request: NextRequest,
) {
  const previewToken = request.headers.get("x-ag-preview-token");
  const previewPayload = await verifyWidgetPreviewToken(previewToken, widget.widget_public_key);

  if (!previewPayload) {
    return {
      isPreview: false,
      previewPayload: null,
      previewDraft: null,
      runtimeConfig: null,
    };
  }

  const requestedRevision =
    request.headers.get("x-ag-preview-revision")?.trim() ||
    previewPayload.revision ||
    null;

  if (!requestedRevision) {
    return {
      isPreview: true,
      previewPayload,
      previewDraft: null,
      runtimeConfig: null,
    };
  }

  const previewDraft = await loadWidgetPreviewDraft(
    supabase,
    widget.id,
    requestedRevision,
  );

  const runtimeConfig = previewDraft
    ? await buildDraftWidgetRuntimeConfig(supabase, widget, previewDraft.payload, {
        preview: true,
      })
    : null;

  return {
    isPreview: true,
    previewPayload,
    previewDraft,
    runtimeConfig,
  };
}
