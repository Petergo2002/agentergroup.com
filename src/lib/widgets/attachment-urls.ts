import type { WidgetAdminSupabase } from "./server-types";

export const WIDGET_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface WidgetAttachmentUrl {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

interface WidgetAttachmentRow {
  id: string;
  widget_id: string;
  widget_session_id: string;
  storage_bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
}

export interface ResolvedWidgetAttachmentUrls {
  byId: Map<string, WidgetAttachmentUrl>;
  /** Ids that are not stored against this widget and session. */
  missingIds: string[];
  /** Ids that exist but could not be signed. */
  unsignedIds: string[];
}

/**
 * Resolves attachment ids to signed URLs with one table read and one signing
 * batch per storage bucket.
 *
 * Both the chat turn and the restored transcript need the same thing, and doing
 * it per message or per attachment turned one conversation into a burst of
 * round trips — on the chat route that burst sits directly between the visitor
 * pressing send and the model being called.
 */
export async function resolveWidgetAttachmentUrls(
  supabase: WidgetAdminSupabase,
  input: {
    widgetId: string;
    widgetSessionId: string;
    attachmentIds: string[];
    ttlSeconds?: number;
  },
): Promise<ResolvedWidgetAttachmentUrls> {
  const attachmentIds = [...new Set(input.attachmentIds)];
  const byId = new Map<string, WidgetAttachmentUrl>();

  if (attachmentIds.length === 0) {
    return { byId, missingIds: [], unsignedIds: [] };
  }

  const { data, error } = await supabase
    .from("widget_attachments")
    .select<WidgetAttachmentRow>(
      "id, widget_id, widget_session_id, storage_bucket, storage_path, original_name, mime_type, file_size_bytes",
    )
    .eq("widget_id", input.widgetId)
    .eq("widget_session_id", input.widgetSessionId)
    .in("id", attachmentIds);

  if (error) {
    throw new Error("Failed to validate attachments.");
  }

  const rows = (data ?? []) as WidgetAttachmentRow[];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const missingIds = attachmentIds.filter((id) => !rowById.has(id));

  if (rows.length === 0) {
    return { byId, missingIds, unsignedIds: [] };
  }

  const pathsByBucket = new Map<string, string[]>();
  for (const row of rows) {
    const paths = pathsByBucket.get(row.storage_bucket);
    if (paths) {
      paths.push(row.storage_path);
    } else {
      pathsByBucket.set(row.storage_bucket, [row.storage_path]);
    }
  }

  const ttlSeconds = input.ttlSeconds ?? WIDGET_ATTACHMENT_SIGNED_URL_TTL_SECONDS;
  const signedUrlByPath = new Map<string, string>();

  await Promise.all(
    [...pathsByBucket].map(async ([bucket, paths]) => {
      const { data: signedUrls, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, ttlSeconds);

      if (signedUrlError || !Array.isArray(signedUrls)) {
        return;
      }

      for (const entry of signedUrls as {
        path?: string | null;
        signedUrl?: string | null;
        error?: string | null;
      }[]) {
        if (entry.path && entry.signedUrl && !entry.error) {
          signedUrlByPath.set(`${bucket}:${entry.path}`, entry.signedUrl);
        }
      }
    }),
  );

  const unsignedIds: string[] = [];

  for (const row of rows) {
    const url = signedUrlByPath.get(`${row.storage_bucket}:${row.storage_path}`);

    if (!url) {
      unsignedIds.push(row.id);
      continue;
    }

    byId.set(row.id, {
      id: row.id,
      url,
      name: row.original_name,
      type: row.mime_type,
      size: row.file_size_bytes,
    });
  }

  return { byId, missingIds, unsignedIds };
}

/** Reads attachment ids out of stored message metadata. */
export function readWidgetAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) =>
    item && typeof item === "object" && "id" in item && typeof item.id === "string"
      ? [item.id]
      : [],
  );
}
