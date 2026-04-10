import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedClientIp } from "../../src/lib/trusted-client-ip.ts";

function buildHeaders(headers: Record<string, string>) {
  return new Headers(headers);
}

test("ignores spoofable x-forwarded-for when a trusted platform header is present", () => {
  const headers = buildHeaders({
    "x-forwarded-for": "203.0.113.99",
    "x-vercel-forwarded-for": "198.51.100.10",
  });

  assert.equal(resolveTrustedClientIp(headers), "198.51.100.10");
});

test("does not trust x-forwarded-for on its own", () => {
  const headers = buildHeaders({
    "x-forwarded-for": "203.0.113.99",
  });

  assert.equal(resolveTrustedClientIp(headers), null);
});

test("accepts cf-connecting-ip when present", () => {
  const headers = buildHeaders({
    "cf-connecting-ip": "198.51.100.20",
  });

  assert.equal(resolveTrustedClientIp(headers), "198.51.100.20");
});

test("uses the last forwarded token from trusted platform headers", () => {
  const headers = buildHeaders({
    "x-vercel-forwarded-for": "203.0.113.99, 198.51.100.30",
  });

  assert.equal(resolveTrustedClientIp(headers), "198.51.100.30");
});
