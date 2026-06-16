import "server-only";

import { generatePdfFromText } from "@/lib/assistants/pdf";
import type { AssistantDownloadAsset } from "@/lib/types";

const PDF_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);
const URL_KEYS = [
  "url",
  "download_url",
  "downloadUrl",
  "file_url",
  "fileUrl",
  "presigned_url",
  "presignedUrl",
  "link",
] as const;
const NAME_KEYS = ["filename", "file_name", "fileName", "name", "title"] as const;
const MIME_KEYS = ["mime_type", "mimeType", "mimetype", "content_type", "contentType", "type"] as const;
const BASE64_KEYS = ["data_base64", "dataBase64", "base64", "file_base64", "fileBase64"] as const;
const MAX_WALK_DEPTH = 6;

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function looksLikePdfMime(value: string | null) {
  return value ? PDF_MIME_TYPES.has(value.trim().toLowerCase()) : false;
}

function looksLikePdfName(value: string | null) {
  return value ? /\.pdf$/i.test(value.trim()) : false;
}

function normalizeDownloadUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function looksLikePdfUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return /\.pdf$/i.test(url.pathname) || /\.pdf(?:$|[?#])/i.test(value);
  } catch {
    return /\.pdf(?:$|[?#])/i.test(value);
  }
}

function getRecordValue(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = pickString(Reflect.get(record, key));
    if (value) {
      return value;
    }
  }

  return null;
}

function getFilenameFromUrl(url: string) {
  try {
    const { pathname } = new URL(url);
    const lastSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return lastSegment ? decodeURIComponent(lastSegment) : null;
  } catch {
    return null;
  }
}

export function sanitizeAssistantDownloadFilename(value: string | null | undefined) {
  const raw = (value ?? "").trim().replace(/[^\w.\- ]+/g, "_");
  const normalized = raw || "generated-pdf.pdf";
  return looksLikePdfName(normalized) ? normalized : `${normalized}.pdf`;
}

function createAssetFromRecord(
  record: Record<string, unknown>,
  preferPdf: boolean,
) {
  const embeddedDataBase64 = getRecordValue(record, BASE64_KEYS);
  const url = normalizeDownloadUrl(getRecordValue(record, URL_KEYS));

  if (!url && !embeddedDataBase64) {
    return null;
  }

  const filename = getRecordValue(record, NAME_KEYS) ?? (url ? getFilenameFromUrl(url) : null);
  const mimeType = getRecordValue(record, MIME_KEYS);
  const shouldTreatAsPdf =
    preferPdf || looksLikePdfMime(mimeType) || looksLikePdfName(filename) || looksLikePdfUrl(url);

  if (!shouldTreatAsPdf) {
    return null;
  }

  const safeFilename = sanitizeAssistantDownloadFilename(filename);

  return {
    url: url ?? `embedded://pdf/${encodeURIComponent(safeFilename)}`,
    filename: safeFilename,
    mimeType: mimeType ?? "application/pdf",
    label: `Download ${safeFilename}`,
    embeddedDataBase64: embeddedDataBase64 ?? null,
  } satisfies AssistantDownloadAsset;
}

function walkForAssets(
  value: unknown,
  preferPdf: boolean,
  assets: AssistantDownloadAsset[],
  seen: Set<unknown>,
  depth: number,
) {
  if (value === null || value === undefined || depth > MAX_WALK_DEPTH) {
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkForAssets(item, preferPdf, assets, seen, depth + 1);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const asset = createAssetFromRecord(record, preferPdf);

  if (asset) {
    assets.push(asset);
  }

  for (const nestedValue of Object.values(record)) {
    walkForAssets(nestedValue, preferPdf, assets, seen, depth + 1);
  }
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractPdfLinksFromText(value: string, preferPdf: boolean) {
  const matches = value.match(/https?:\/\/[^\s)"'>]+/gi) ?? [];

  return matches
    .map((match) => normalizeDownloadUrl(match))
    .filter((match): match is string => Boolean(match))
    .filter((match) => preferPdf || looksLikePdfUrl(match))
    .map((url) => ({
      url,
      filename: sanitizeAssistantDownloadFilename(getFilenameFromUrl(url)),
      mimeType: "application/pdf",
      label: `Download ${sanitizeAssistantDownloadFilename(getFilenameFromUrl(url))}`,
    }));
}

export function extractPdfDownloadsFromToolMessage(args: {
  content: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
  toolName?: string | null;
}) {
  const preferPdf = /pdf/i.test(args.toolName ?? "");
  const assets: AssistantDownloadAsset[] = [];
  const seen = new Set<unknown>();
  const parsedContent = parseJsonRecord(args.content);

  walkForAssets(args.metadata ?? null, preferPdf, assets, seen, 0);
  walkForAssets(parsedContent, preferPdf, assets, seen, 0);

  if (args.content) {
    assets.push(...extractPdfLinksFromText(args.content, preferPdf));
  }

  const deduped = new Map<string, AssistantDownloadAsset>();

  for (const asset of assets) {
    if (!deduped.has(asset.url)) {
      deduped.set(asset.url, asset);
    }
  }

  return Array.from(deduped.values());
}

export function extractPdfDownloadsFromAssistantMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  const debugTrace =
    metadata &&
    typeof metadata.debugTrace === "object" &&
    metadata.debugTrace !== null
      ? (metadata.debugTrace as Record<string, unknown>)
      : null;
  const events = Array.isArray(debugTrace?.events)
    ? (debugTrace?.events as Array<Record<string, unknown>>)
    : [];
  const downloads: AssistantDownloadAsset[] = [];

  for (const event of events) {
    if (event.type !== "tool_call" || event.name !== "create_pdf_from_text") {
      continue;
    }

    const args =
      typeof event.args === "object" && event.args !== null
        ? (event.args as Record<string, unknown>)
        : null;
    const text = pickString(args?.text);

    if (!text) {
      continue;
    }

    const filename = sanitizeAssistantDownloadFilename(pickString(args?.filename));
    const pdfBytes = generatePdfFromText(text);

    downloads.push({
      url: `embedded://pdf/${encodeURIComponent(filename)}`,
      filename,
      mimeType: "application/pdf",
      label: `Download ${filename}`,
      embeddedDataBase64: pdfBytes.toString("base64"),
    });
  }

  const deduped = new Map<string, AssistantDownloadAsset>();

  for (const asset of downloads) {
    if (!deduped.has(asset.filename)) {
      deduped.set(asset.filename, asset);
    }
  }

  return Array.from(deduped.values());
}
