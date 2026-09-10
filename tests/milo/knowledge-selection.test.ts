import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeKnowledgeSelection } from "../../src/lib/knowledge-selection.ts";

test("Milo draft save drops deleted knowledge references without admitting foreign IDs", () => {
  assert.deepEqual(
    sanitizeKnowledgeSelection(
      {
        sourceIds: ["valid-source", "deleted-source", "valid-source", "foreign-source"],
        folderIds: ["deleted-folder", "valid-folder"],
      },
      ["valid-source"],
      ["valid-folder"],
    ),
    {
      sourceIds: ["valid-source"],
      folderIds: ["valid-folder"],
    },
  );
});
