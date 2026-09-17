import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeReportContext,
  reportError,
} from "../../src/lib/observability/report.ts";

/**
 * The reporter is allowed to send data to a third party, so its redaction is a
 * security control, not a nicety.
 */

test("credential-shaped keys never survive sanitisation", () => {
  const sanitized = sanitizeReportContext({
    operation: "test",
    accessToken: "secret-value",
    visitorToken: "secret-value",
    apiKey: "sk_live_abc",
    api_key: "sk_live_abc",
    password: "hunter2",
    authorization: "Bearer abc",
    cookie: "session=abc",
    stripeSignature: "whsec_abc",
    SENTRY_DSN: "https://x@y/1",
    nested: { privateKey: "-----BEGIN", safeId: "keep-me" },
  });

  const serialized = JSON.stringify(sanitized);
  for (const secret of [
    "secret-value",
    "sk_live_abc",
    "hunter2",
    "Bearer abc",
    "session=abc",
    "whsec_abc",
    "-----BEGIN",
  ]) {
    assert.equal(
      serialized.includes(secret),
      false,
      `redaction leaked: ${secret}`,
    );
  }

  assert.equal(sanitized.operation, "test");
  assert.equal((sanitized.nested as Record<string, unknown>).safeId, "keep-me");
});

test("identifiers needed for debugging are preserved", () => {
  const sanitized = sanitizeReportContext({
    operation: "widget.chat.stream",
    workspaceId: "ws-1",
    widgetId: "wgt-1",
    widgetSessionId: "sess-1",
    route: "/api/public/widgets/[widgetPublicKey]/chat",
    jobType: "after",
  });

  assert.equal(sanitized.workspaceId, "ws-1");
  assert.equal(sanitized.widgetId, "wgt-1");
  assert.equal(sanitized.widgetSessionId, "sess-1");
  assert.equal(sanitized.jobType, "after");
});

test("long free text is truncated so customer content cannot be shipped whole", () => {
  const sanitized = sanitizeReportContext({
    operation: "test",
    transcript: "x".repeat(5000),
  });

  const value = sanitized.transcript as string;
  assert.ok(value.length < 300, `expected truncation, got ${value.length}`);
  assert.match(value, /\[truncated\]$/);
});

test("reporting never throws, even on unserialisable context", () => {
  const circular: Record<string, unknown> = { operation: "test" };
  circular.self = circular;

  assert.doesNotThrow(() => {
    reportError(new Error("boom"), circular as never);
    reportError("not-an-error", { operation: "test" });
    reportError(null, { operation: "test" });
  });
});
