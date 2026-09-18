import assert from "node:assert/strict";
import test from "node:test";
import { inspectWidgetAttachment } from "../../src/lib/widget-attachments.ts";

const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PDF_HEADER = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const PLAIN_TEXT = new TextEncoder().encode("Our refund window is 30 days.");

test("images are still accepted while document upload is off", () => {
  // Images go straight to the vision model, so they are readable on arrival
  // and are unaffected by the knowledge-indexing race.
  assert.deepEqual(inspectWidgetAttachment(PNG_HEADER, "photo.png", "image/png"), {
    mimeType: "image/png",
    extension: "png",
  });
});

test("PDF uploads are rejected with an explanation the visitor can act on", () => {
  assert.throws(
    () => inspectWidgetAttachment(PDF_HEADER, "terms.pdf", "application/pdf"),
    /Document uploads are not available right now/,
  );
});

test("plain text uploads are rejected too", () => {
  assert.throws(
    () => inspectWidgetAttachment(PLAIN_TEXT, "notes.txt", "text/plain"),
    /Document uploads are not available right now/,
  );
});

test("documents come back when the launch flag is set", () => {
  process.env.WIDGET_DOCUMENT_UPLOAD_ENABLED = "true";

  try {
    // The flag is read per call, so no module reload is needed.
    assert.deepEqual(
      inspectWidgetAttachment(PDF_HEADER, "terms.pdf", "application/pdf"),
      { mimeType: "application/pdf", extension: "pdf" },
    );
  } finally {
    delete process.env.WIDGET_DOCUMENT_UPLOAD_ENABLED;
  }
});
