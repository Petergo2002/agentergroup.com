// Relative: this module is loaded directly by tests under plain `node`, which
// does not resolve the `@/` path alias.
import { isDocumentUploadEnabled } from "./upload-mode.ts";

export const MAX_WIDGET_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_WIDGET_ATTACHMENTS_PER_SESSION = 10;
export const MAX_WIDGET_ATTACHMENT_BYTES_PER_SESSION = 20 * 1024 * 1024;
export const MAX_WIDGET_ATTACHMENTS_PER_MESSAGE = 5;

export const WIDGET_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
] as const;

export type WidgetAttachmentMimeType =
  (typeof WIDGET_ATTACHMENT_MIME_TYPES)[number];

export interface InspectedWidgetAttachment {
  mimeType: WidgetAttachmentMimeType;
  extension: string;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function normalizeDeclaredMimeType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function getFileExtension(fileName: string) {
  const match = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function detectMimeType(bytes: Uint8Array, fileName: string) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" } as const;
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: "jpg" } as const;
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" } as const;
  }

  const gifHeader = readAscii(bytes, 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { mimeType: "image/gif", extension: "gif" } as const;
  }

  if (readAscii(bytes, 0, 5) === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" } as const;
  }

  const extension = getFileExtension(fileName);
  let decodedText: string;

  try {
    decodedText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The uploaded file content is not a supported file type.");
  }

  if (decodedText.includes("\u0000")) {
    throw new Error("The uploaded file content is not valid text.");
  }

  const normalizedStart = decodedText
    .slice(0, 4096)
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();

  if (
    extension === "svg" ||
    normalizedStart.startsWith("<svg") ||
    (normalizedStart.startsWith("<?xml") && normalizedStart.includes("<svg"))
  ) {
    throw new Error("SVG uploads are not supported.");
  }

  return { mimeType: "text/plain", extension: "txt" } as const;
}

export function inspectWidgetAttachment(
  bytes: Uint8Array,
  fileName: string,
  declaredMimeType: string,
): InspectedWidgetAttachment {
  if (bytes.byteLength === 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (bytes.byteLength > MAX_WIDGET_ATTACHMENT_SIZE_BYTES) {
    throw new Error("File size exceeds the 5MB limit.");
  }

  const normalizedDeclaredMime = normalizeDeclaredMimeType(declaredMimeType);
  const extension = getFileExtension(fileName);

  if (normalizedDeclaredMime === "image/svg+xml" || extension === "svg") {
    throw new Error("SVG uploads are not supported.");
  }

  const detected = detectMimeType(bytes, fileName);

  if (
    normalizedDeclaredMime &&
    normalizedDeclaredMime !== "application/octet-stream" &&
    normalizedDeclaredMime !== detected.mimeType
  ) {
    throw new Error("The uploaded file content does not match its MIME type.");
  }

  const expectedExtensions: Record<WidgetAttachmentMimeType, string[]> = {
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "application/pdf": ["pdf"],
    "text/plain": ["txt", "text", "log", "md"],
  };

  if (
    extension &&
    !expectedExtensions[detected.mimeType].includes(extension)
  ) {
    throw new Error("The uploaded file extension does not match its content.");
  }

  if (
    !isDocumentUploadEnabled() &&
    (detected.mimeType === "application/pdf" ||
      detected.mimeType === "text/plain")
  ) {
    throw new Error(
      "Document uploads are not available right now. You can send an image, or paste the text directly into the chat.",
    );
  }

  return detected;
}

export function sanitizeWidgetAttachmentName(fileName: string) {
  const sanitized = fileName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return sanitized || "attachment";
}
