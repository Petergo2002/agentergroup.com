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
    const lines = [
      `Source ${index + 1}: ${match.source_name}`,
      `Similarity: ${(match.similarity * 100).toFixed(1)}%`,
      match.content,
    ];

    return lines.join("\n");
  });

  return [
    "Knowledge base context:",
    "Use these excerpts when they are relevant. Prefer them over guessing.",
    "If the excerpts are insufficient, say so plainly instead of inventing facts.",
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
