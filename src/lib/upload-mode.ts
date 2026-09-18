/**
 * Document uploads (PDF / plain text) are disabled during the managed pilot.
 *
 * Images are unaffected: they are passed straight to the vision model and are
 * readable the moment they arrive. A PDF or text file is different — the model
 * only receives its URL, so answering from it depends on the knowledge
 * indexing pipeline finishing first. That pipeline is invoked without being
 * awaited, so a visitor can upload a document and ask about it before any of
 * its contents are searchable, and a failed invocation leaves the file pending
 * with nothing to explain the silence.
 *
 * Set WIDGET_DOCUMENT_UPLOAD_ENABLED=true to restore PDF and text uploads once
 * indexing reports pending/ready/error states honestly.
 */
export function isDocumentUploadEnabled() {
  return process.env.WIDGET_DOCUMENT_UPLOAD_ENABLED === "true";
}
