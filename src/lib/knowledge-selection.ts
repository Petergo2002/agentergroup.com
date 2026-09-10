export interface KnowledgeSelection {
  sourceIds: string[];
  folderIds: string[];
}

function keepValidIds(ids: string[], validIds: Iterable<string>) {
  const allowed = new Set(validIds);
  return Array.from(new Set(ids.filter((id) => id && allowed.has(id))));
}

/**
 * Removes deleted or otherwise unavailable knowledge references from a saved
 * builder definition before that definition is sent back to Supabase.
 */
export function sanitizeKnowledgeSelection(
  selection: KnowledgeSelection,
  availableSourceIds: Iterable<string>,
  availableFolderIds: Iterable<string>,
): KnowledgeSelection {
  return {
    sourceIds: keepValidIds(selection.sourceIds, availableSourceIds),
    folderIds: keepValidIds(selection.folderIds, availableFolderIds),
  };
}
