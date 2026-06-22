import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomationRunResult,
  readAutomationRunResult,
} from "../../src/lib/automation/result.ts";

function report(
  decision: "action_taken" | "no_action" | "needs_input" | "action_failed",
  overrides: Record<string, unknown> = {},
) {
  return JSON.stringify({
    decision,
    summary: "Reviewed the incoming email.",
    reason: "The saved instructions were evaluated.",
    missingInformation: [],
    ...overrides,
  });
}

test("successful tool evidence determines that an action was taken", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("no_action"),
    toolMessages: [{
      name: "GMAIL_REPLY_TO_THREAD",
      content: JSON.stringify({ thread_id: "thread-123", message_id: "message-456" }),
    }],
  });

  assert.equal(result.decision, "action_taken");
  assert.equal(result.actions[0]?.label, "Replied in Gmail thread");
  assert.equal(result.actions[0]?.threadId, "thread-123");
  assert.equal(result.actions[0]?.messageId, "message-456");
});

test("a model cannot claim action_taken without a successful tool result", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("action_taken"),
    toolMessages: [],
  });

  assert.equal(result.decision, "no_action");
  assert.deepEqual(result.actions, []);
});

test("missing information is preserved when no action was attempted", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("needs_input", {
      reason: "The sender address was missing.",
      missingInformation: ["Sender email", "Thread id"],
    }),
    toolMessages: [],
  });

  assert.equal(result.decision, "needs_input");
  assert.deepEqual(result.missingInformation, ["Sender email", "Thread id"]);
});

test("failed tools produce an action_failed outcome even if the model says otherwise", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("action_taken"),
    toolMessages: [{
      name: "GMAIL_SEND_EMAIL",
      content: "Error executing tool: Gmail permission denied",
    }],
  });

  assert.equal(result.decision, "action_failed");
  assert.equal(result.actions[0]?.status, "failed");
  assert.match(result.actions[0]?.detail ?? "", /permission denied/i);
});

test("empty tool results are never treated as successful actions", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("action_taken"),
    toolMessages: [{ name: "GMAIL_SEND_EMAIL", content: "" }],
  });

  assert.equal(result.decision, "action_failed");
  assert.equal(result.actions[0]?.status, "failed");
});

test("stored action errors redact email addresses and nested failures are detected", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("action_taken"),
    toolMessages: [{
      name: "GMAIL_SEND_EMAIL",
      content: JSON.stringify({ data: { success: false, error: "Denied for person@example.com" } }),
    }],
  });

  assert.equal(result.decision, "action_failed");
  assert.doesNotMatch(result.actions[0]?.detail ?? "", /person@example\.com/);
  assert.match(result.actions[0]?.detail ?? "", /email redacted/);
  assert.doesNotMatch(result.actions[0]?.detail ?? "", /\"data\"/);
});

test("failed action details never persist unrelated raw tool payload fields", () => {
  const result = buildAutomationRunResult({
    assistantContent: report("action_taken"),
    toolMessages: [{
      name: "GMAIL_SEND_EMAIL",
      content: JSON.stringify({
        success: false,
        request: { body: "private message body", apiKey: "top-secret" },
        error: "Provider rejected https://example.com/failure?token=top-secret",
      }),
    }],
  });

  assert.equal(result.decision, "action_failed");
  assert.doesNotMatch(result.actions[0]?.detail ?? "", /private message body|top-secret/);
  assert.match(result.actions[0]?.detail ?? "", /url redacted/);
});

test("legacy free-form summaries remain readable", () => {
  const result = buildAutomationRunResult({
    assistantContent: "The message was reviewed and did not require a response.",
    toolMessages: [],
  });

  assert.equal(result.decision, "no_action");
  assert.equal(result.summary, "The message was reviewed and did not require a response.");
  assert.equal(readAutomationRunResult(result)?.version, 1);
});
