import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppContentSecurityPolicy,
  getAppSecurityHeaders,
} from "../../src/lib/security-headers.ts";

function getCspDirective(csp: string, directiveName: string) {
  return (
    csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith(`${directiveName} `)) ?? ""
  );
}

test("app security headers include baseline browser protections", () => {
  const headers = getAppSecurityHeaders();
  const headerMap = new Map(headers.map((entry) => [entry.key, entry.value]));

  assert.equal(headerMap.get("Strict-Transport-Security")?.includes("max-age="), true);
  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(headerMap.get("Content-Security-Policy"));
});

test("app security headers disable unused browser permissions", () => {
  const headers = getAppSecurityHeaders();
  const headerMap = new Map(headers.map((entry) => [entry.key, entry.value]));
  const permissionsPolicy = headerMap.get("Permissions-Policy");

  assert.ok(permissionsPolicy);
  assert.match(permissionsPolicy, /camera=\(\)/);
  assert.match(permissionsPolicy, /microphone=\(\)/);
});

test("app security headers can omit CSP when a request nonce is required", () => {
  const headers = getAppSecurityHeaders({ contentSecurityPolicy: false });
  const headerMap = new Map(headers.map((entry) => [entry.key, entry.value]));

  assert.ok(headerMap.get("Strict-Transport-Security"));
  assert.equal(headerMap.has("Content-Security-Policy"), false);
});

test("content security policy protects framing while allowing current widget preview assets", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  // @ts-expect-error - testing process.env mutation
  process.env.NODE_ENV = "production";
  const csp = buildAppContentSecurityPolicy({ nonce: "test-nonce" });
  // @ts-expect-error - testing process.env mutation
  process.env.NODE_ENV = previousNodeEnv;

  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /fonts\.googleapis\.com/);
  assert.match(csp, /fonts\.gstatic\.com/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);

  const scriptSrc = getCspDirective(csp, "script-src");
  assert.match(scriptSrc, /'nonce-test-nonce'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
});

test("CSP does not include the legacy Supabase fallback when env is missing", () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    const csp = buildAppContentSecurityPolicy();

    assert.doesNotMatch(csp, /rklntfzmqayziqesjoih\.supabase\.co/);
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("development CSP allows Next.js inline bootstrap and eval-based debugging", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  // @ts-expect-error - testing process.env mutation
  process.env.NODE_ENV = "development";
  const csp = buildAppContentSecurityPolicy();
  // @ts-expect-error - testing process.env mutation
  process.env.NODE_ENV = previousNodeEnv;

  const scriptSrc = getCspDirective(csp, "script-src");
  assert.match(scriptSrc, /'unsafe-inline'/);
  assert.match(scriptSrc, /'unsafe-eval'/);
});
