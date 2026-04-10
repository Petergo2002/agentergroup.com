import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppContentSecurityPolicy,
  getAppSecurityHeaders,
} from "../../src/lib/security-headers.ts";

test("app security headers include baseline browser protections", () => {
  const headers = getAppSecurityHeaders();
  const headerMap = new Map(headers.map((entry) => [entry.key, entry.value]));

  assert.equal(headerMap.get("Strict-Transport-Security")?.includes("max-age="), true);
  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(headerMap.get("Content-Security-Policy"));
});

test("content security policy protects framing while allowing current widget preview assets", () => {
  const csp = buildAppContentSecurityPolicy();

  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /fonts\.googleapis\.com/);
  assert.match(csp, /fonts\.gstatic\.com/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
});
