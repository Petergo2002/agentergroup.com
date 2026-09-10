import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizePostAuthRedirectTo,
  sanitizeRedirectTo,
} from "../../src/lib/auth-redirect.ts";

const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";

test("keeps relative in-app redirects", () => {
  assert.equal(
    sanitizeRedirectTo("/widgets/123?tab=deploy#section"),
    "/widgets/123?tab=deploy#section",
  );
});

test("drops absolute and protocol-relative redirects", () => {
  assert.equal(
    sanitizeRedirectTo("https://evil.example/phish"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );
  assert.equal(
    sanitizeRedirectTo("//evil.example/phish"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );
});

test("drops host-escaping redirects that only look relative", () => {
  // Backslashes normalise to slashes in special-scheme URLs, so "/\evil.example"
  // starts with "/" but the browser resolves it to https://evil.example/.
  // Control characters are stripped by the browser before parsing, so a tab or
  // newline can reconstitute a protocol-relative URL the same way.
  const escapes = [
    "/\\evil.example",
    "/\\\\evil.example",
    "\\/evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\u0000/evil.example",
    " //evil.example",
  ];

  for (const value of escapes) {
    const sanitized = sanitizeRedirectTo(value);
    assert.equal(
      sanitized,
      DEFAULT_POST_LOGIN_REDIRECT,
      `${JSON.stringify(value)} must not survive sanitisation`,
    );
    assert.equal(
      new URL(sanitized, "https://app.avenro.se").origin,
      "https://app.avenro.se",
      `${JSON.stringify(value)} must not resolve off-origin`,
    );
  }
});

test("preserves ordinary paths, including hyphens and encoded characters", () => {
  assert.equal(sanitizeRedirectTo("/my-page-with-hyphens"), "/my-page-with-hyphens");
  assert.equal(sanitizeRedirectTo("/leads?q=a%20b"), "/leads?q=a%20b");
});

test("keeps successful auth out of auth and login pages", () => {
  assert.equal(sanitizePostAuthRedirectTo("/login"), DEFAULT_POST_LOGIN_REDIRECT);
  assert.equal(
    sanitizePostAuthRedirectTo("/login?redirectTo=/dashboard"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );
  assert.equal(sanitizePostAuthRedirectTo("/signup"), DEFAULT_POST_LOGIN_REDIRECT);
  assert.equal(
    sanitizePostAuthRedirectTo("/signup?plan=pro"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );
  assert.equal(sanitizePostAuthRedirectTo("/auth/logout"), DEFAULT_POST_LOGIN_REDIRECT);
  assert.equal(sanitizePostAuthRedirectTo("/settings/billing"), "/settings/billing");
});
