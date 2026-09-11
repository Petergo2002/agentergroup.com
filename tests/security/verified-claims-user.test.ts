import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildUserFromVerifiedClaims } from "../../src/lib/app/verified-claims-user.ts";

const requestContext = readFileSync("src/lib/app/request-context.ts", "utf8");

test("claims without a subject never produce a user", () => {
  // A missing or non-string `sub` must not yield an authenticated identity,
  // otherwise the workspace bootstrap would run for nobody.
  assert.equal(buildUserFromVerifiedClaims(null), null);
  assert.equal(buildUserFromVerifiedClaims(undefined), null);
  assert.equal(buildUserFromVerifiedClaims({}), null);
  assert.equal(buildUserFromVerifiedClaims({ sub: "" }), null);
  assert.equal(buildUserFromVerifiedClaims({ sub: 123 }), null);
  assert.equal(buildUserFromVerifiedClaims({ sub: null }), null);
  assert.equal(buildUserFromVerifiedClaims({ email: "a@b.c" }), null);
});

test("the identity comes from the token subject, not a client-supplied field", () => {
  const user = buildUserFromVerifiedClaims({
    sub: "11111111-1111-1111-1111-111111111111",
    email: "owner@example.com",
    // A token that also carries an `id` must not be able to override `sub`.
    id: "22222222-2222-2222-2222-222222222222",
  });

  assert.equal(user?.id, "11111111-1111-1111-1111-111111111111");
  assert.equal(user?.email, "owner@example.com");
});

test("the fields the workspace bootstrap reads survive the conversion", () => {
  const user = buildUserFromVerifiedClaims({
    sub: "user-1",
    email: "peter@example.com",
    user_metadata: {
      full_name: "Peter Gorgees",
      avatar_url: "https://example.com/a.png",
      workspace_name: "Avenro",
    },
  });

  assert.equal(user?.user_metadata.full_name, "Peter Gorgees");
  assert.equal(user?.user_metadata.avatar_url, "https://example.com/a.png");
  assert.equal(user?.user_metadata.workspace_name, "Avenro");
});

test("malformed metadata degrades to an empty object rather than throwing", () => {
  for (const metadata of [null, "nope", 42, ["a"], undefined]) {
    const user = buildUserFromVerifiedClaims({
      sub: "user-1",
      user_metadata: metadata,
    });
    assert.deepEqual(user?.user_metadata, {});
  }
});

test("the request context verifies claims and fails closed on error", () => {
  // getClaims verifies the JWT signature locally against the project's ES256
  // key; getUser's network round trip is what this removes.
  assert.match(requestContext, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(requestContext, /supabase\.auth\.getUser\(\)/);

  // A verification error must yield no user, never a partially built one.
  assert.match(requestContext, /if \(error\) \{\s*return null;\s*\}/);
  assert.match(
    requestContext,
    /return buildUserFromVerifiedClaims\(data\?\.claims\);/,
  );
});
