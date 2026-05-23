import type { KnowledgeFolderRecord } from "./types";

export interface KnowledgeFolderSourceLink {
  knowledge_source_id: string;
}

export type KnowledgeFolderJoinRow = KnowledgeFolderRecord & {
  sources?: KnowledgeFolderSourceLink[];
};

export function normalizeKnowledgeFolderName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeKnowledgeFolderDescription(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeKnowledgeFolderSourceIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function toKnowledgeFolderWithSources(folder: KnowledgeFolderJoinRow) {
  return {
    ...folder,
    sourceIds: (folder.sources ?? [])
      .map((source) => source.knowledge_source_id)
      .filter(Boolean),
  };
}
