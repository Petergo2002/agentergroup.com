import type {
  KnowledgeMatchRecord,
  KnowledgeSourceRecord,
  KnowledgeSourceStatus,
} from "@/lib/types";

export const KNOWLEDGE_BUCKET = "knowledge-files";
export const KNOWLEDGE_MATCH_THRESHOLD = 0.7;
export const KNOWLEDGE_MATCH_COUNT = 8;
export const SUPPORTED_KNOWLEDGE_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
] as const;

export const SUPPORTED_KNOWLEDGE_EXTENSIONS = [".txt", ".md", ".pdf"] as const;

export function inferKnowledgeMimeType(fileName: string, mimeType: string) {
  if (mimeType.trim()) {
    return mimeType.trim().toLowerCase();
  }

  const lower = fileName.toLowerCase();

  if (lower.endsWith(".md")) {
    return "text/markdown";
  }

  if (lower.endsWith(".txt")) {
    return "text/plain";
  }

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  return "";
}

export function isSupportedKnowledgeMimeType(
  mimeType: string,
): mimeType is (typeof SUPPORTED_KNOWLEDGE_MIME_TYPES)[number] {
  return SUPPORTED_KNOWLEDGE_MIME_TYPES.includes(
    mimeType as (typeof SUPPORTED_KNOWLEDGE_MIME_TYPES)[number],
  );
}

export function getSupportedKnowledgeFileTypesLabel() {
  return "TXT, MD, and PDF";
}

export function isReadyKnowledgeSource(source: KnowledgeSourceRecord) {
  return source.status === "ready";
}

export function getKnowledgeStatusTone(status: KnowledgeSourceStatus) {
  switch (status) {
    case "ready":
      return "bg-primary/10 text-primary";
    case "processing":
      return "bg-amber-500/10 text-amber-700";
    case "failed":
      return "bg-error/10 text-error";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}

export function buildKnowledgeContext(matches: KnowledgeMatchRecord[]) {
  if (matches.length === 0) {
    return null;
  }

  const sections = matches.map((match, index) => {
    // Check metadata to see if this is an ephemeral user upload
    const isUserUpload = match.metadata?.ephemeral === true;
    const sourceLabel = isUserUpload 
      ? `[USER UPLOADED FILE: ${match.source_name}]` 
      : `[LIBRARY SOURCE: ${match.source_name}]`;

    const lines = [
      `Source ${index + 1}: ${sourceLabel}`,
      `Similarity Score: ${(match.similarity * 100).toFixed(1)}%`,
      `--- START CONTENT ---`,
      match.content,
      `--- END CONTENT ---`,
    ];

    return lines.join("\n");
  });

  return [
    "KNOWLEDGE BASE CONTEXT (including user-uploaded files):",
    "Below are relevant excerpts from your library and any documents the user has uploaded during this session.",
    "If a user asks about a file they sent, refer to the excerpts labeled '[USER UPLOADED FILE]'.",
    "IMPORTANT: You CAN read these files. If information is present below, do NOT claim you cannot access attachments.",
    sections.join("\n\n---\n\n"),
  ].join("\n\n");
}

export function getKnowledgeCitationSummary(matches: KnowledgeMatchRecord[]) {
  return matches.map((match) => ({
    source_id: match.source_id,
    source_name: match.source_name,
    chunk_id: match.chunk_id,
    chunk_index: match.chunk_index,
    similarity: match.similarity,
    metadata: match.metadata,
  }));
}
