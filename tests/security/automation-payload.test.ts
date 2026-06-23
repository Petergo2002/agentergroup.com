import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationTriggerPayload } from "../../src/lib/automation/payload.ts";

test("Gmail automation payloads exclude raw MIME data and retain action context", () => {
  const normalized = normalizeAutomationTriggerPayload("GMAIL_NEW_GMAIL_MESSAGE", {
    id: "message-1",
    thread_id: "thread-1",
    sender: "Sender <sender@example.com>",
    to: "Agent <agent@example.com>",
    subject: "Need help",
    message_text: "Please send the requested details.",
    message_timestamp: "2026-06-22T20:00:00Z",
    label_ids: ["INBOX", "UNREAD"],
    attachment_list: [{ filename: "brief.pdf", mimeType: "application/pdf", size: 42 }],
    payload: {
      headers: [{ name: "Authorization", value: "must-not-be-persisted" }],
      body: { data: "encoded-raw-body" },
    },
  });

  assert.deepEqual(normalized, {
    messageId: "message-1",
    threadId: "thread-1",
    sender: "Sender <sender@example.com>",
    to: "Agent <agent@example.com>",
    subject: "Need help",
    body: "Please send the requested details.",
    timestamp: "2026-06-22T20:00:00Z",
    labelIds: ["INBOX", "UNREAD"],
    attachments: [{ filename: "brief.pdf", mimeType: "application/pdf", size: 42 }],
  });
  assert.equal("payload" in normalized, false);
});

test("non-Gmail automation payloads remain available for future trigger adapters", () => {
  const payload = { event: "created", item: { id: 1 } };
  assert.equal(normalizeAutomationTriggerPayload("FUTURE_TRIGGER", payload), payload);
});
