import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeRedirectTo } from "../../src/lib/auth-redirect.ts";

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
