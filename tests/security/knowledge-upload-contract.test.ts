import assert from "node:assert/strict";
import test from "node:test";
import {
  getSupportedKnowledgeFileTypesLabel,
  inferKnowledgeMimeType,
  isSupportedKnowledgeMimeType,
} from "../../src/lib/knowledge.ts";

test("knowledge MIME inference matches extractor-supported file types", () => {
  assert.equal(inferKnowledgeMimeType("notes.txt", ""), "text/plain");
  assert.equal(inferKnowledgeMimeType("brief.md", ""), "text/markdown");
  assert.equal(inferKnowledgeMimeType("report.pdf", ""), "application/pdf");
});

test("knowledge MIME validation rejects unsupported document formats", () => {
  assert.equal(isSupportedKnowledgeMimeType("text/plain"), true);
  assert.equal(isSupportedKnowledgeMimeType("text/markdown"), true);
  assert.equal(isSupportedKnowledgeMimeType("application/pdf"), true);
  assert.equal(
    isSupportedKnowledgeMimeType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    false,
  );
  assert.equal(isSupportedKnowledgeMimeType("text/csv"), false);
});

test("knowledge supported file type label stays aligned with validation", () => {
  assert.equal(getSupportedKnowledgeFileTypesLabel(), "TXT, MD, and PDF");
});
