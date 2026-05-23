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

test("keeps successful auth out of auth and login pages", () => {
  assert.equal(sanitizePostAuthRedirectTo("/login"), DEFAULT_POST_LOGIN_REDIRECT);
  assert.equal(
    sanitizePostAuthRedirectTo("/login?redirectTo=/dashboard"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );
  assert.equal(sanitizePostAuthRedirectTo("/auth/logout"), DEFAULT_POST_LOGIN_REDIRECT);
  assert.equal(sanitizePostAuthRedirectTo("/settings/billing"), "/settings/billing");
});
