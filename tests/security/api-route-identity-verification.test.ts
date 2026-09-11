import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getVerifiedApiIdentity } from "../../src/lib/app/api-auth.ts";

const VICTIM = "11111111-1111-1111-1111-111111111111";
const ATTACKER = "22222222-2222-2222-2222-222222222222";

function buildClient(options: {
  session: unknown;
  claims?: unknown;
  claimsError?: unknown;
}) {
  return {
    auth: {
      getSession: async () => ({ data: { session: options.session }, error: null }),
      getClaims: async (jwt?: string) => {
        assert.equal(
          jwt,
          (options.session as { access_token?: string } | null)?.access_token,
          "the token handed to getClaims must be the one the session forwards",
        );
        return options.claimsError
          ? { data: null, error: options.claimsError }
          : { data: { claims: options.claims }, error: null };
      },
    },
  } as unknown as Parameters<typeof getVerifiedApiIdentity>[0];
}

test("identity comes from the verified token, not the cookie's user object", async () => {
  // auth-js only shape-checks the cookie, so `session.user` is caller-controlled.
  // A tampered cookie that names the victim must not yield the victim.
  const { user, session } = await getVerifiedApiIdentity(
    buildClient({
      session: {
        access_token: "attacker-token",
        refresh_token: "r",
        expires_at: 9999999999,
        user: { id: VICTIM, email: "victim@example.com" },
      },
      claims: { sub: ATTACKER, email: "attacker@example.com" },
    }),
  );

  assert.equal(user?.id, ATTACKER);
  assert.notEqual(user?.id, VICTIM);
  assert.equal(session?.access_token, "attacker-token");
});

test("a token that fails verification is rejected outright", async () => {
  const { user, session } = await getVerifiedApiIdentity(
    buildClient({
      session: {
        access_token: "forged",
        refresh_token: "r",
        expires_at: 9999999999,
        user: { id: VICTIM },
      },
      claimsError: new Error("Invalid JWT signature"),
    }),
  );

  // Fails closed: no identity and no token to forward downstream.
  assert.equal(user, null);
  assert.equal(session, null);
});

test("claims without a subject never authenticate", async () => {
  const { user, session } = await getVerifiedApiIdentity(
    buildClient({
      session: {
        access_token: "t",
        refresh_token: "r",
        expires_at: 9999999999,
        user: { id: VICTIM },
      },
      claims: { email: "nobody@example.com" },
    }),
  );

  assert.equal(user, null);
  assert.equal(session, null);
});

test("no session means no identity", async () => {
  const { user, session } = await getVerifiedApiIdentity(
    buildClient({ session: null }),
  );

  assert.equal(user, null);
  assert.equal(session, null);
});

function collectRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRouteFiles(full);
    }
    return entry.name === "route.ts" ? [full] : [];
  });
}

test("no route handler takes its identity from an unverified session", () => {
  // `getSession()` is fine for reading `access_token`; deriving `user` from it
  // is an authentication bypass, so the pattern must not reappear.
  const offenders = collectRouteFiles("src/app/api").filter((file) =>
    /=\s*session\?*\.user\b/.test(readFileSync(file, "utf8")),
  );

  assert.deepEqual(offenders, []);
});
