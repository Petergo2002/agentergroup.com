import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEGAL_DOCUMENT_VERSIONS,
  createLegalConsentToken,
  recordLegalAcceptance,
  verifyLegalConsentToken,
} from "../../src/lib/legal-consent.ts";

const TEST_SECRET = "test-only-legal-consent-secret-with-enough-entropy";

test("legal consent tokens are signed, versioned, and time limited", () => {
  const previousSecret = process.env.LEGAL_CONSENT_SECRET;
  process.env.LEGAL_CONSENT_SECRET = TEST_SECRET;

  try {
    const acceptedAt = new Date("2026-08-09T10:00:00.000Z");
    const token = createLegalConsentToken("email_signup", acceptedAt);
    const consent = verifyLegalConsentToken(
      token,
      new Date("2026-08-09T10:05:00.000Z"),
    );

    assert.equal(consent?.termsVersion, LEGAL_DOCUMENT_VERSIONS.terms);
    assert.equal(consent?.privacyVersion, LEGAL_DOCUMENT_VERSIONS.privacy);
    assert.equal(consent?.acceptedAt, acceptedAt.toISOString());
    assert.equal(consent?.method, "email_signup");
    // Tamper with the first signature character, not the last. Verification
    // compares the base64url-DECODED signature bytes, and the final character
    // of a 32-byte HMAC only carries four meaningful bits — four different
    // trailing characters decode to identical bytes. Editing the last
    // character therefore left the signature unchanged often enough to make
    // this assertion pass intermittently without tampering with anything. The
    // first character contributes all six of its bits to the first byte, so
    // changing it always changes what is verified.
    const [encodedPayload, encodedSignature] = token.split(".");
    const tamperedSignature = `${
      encodedSignature.startsWith("A") ? "B" : "A"
    }${encodedSignature.slice(1)}`;
    const tamperedToken = `${encodedPayload}.${tamperedSignature}`;
    assert.notEqual(tamperedToken, token);
    assert.equal(verifyLegalConsentToken(tamperedToken, acceptedAt), null);
    assert.equal(
      verifyLegalConsentToken(token, new Date("2026-08-10T10:00:01.000Z")),
      null,
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.LEGAL_CONSENT_SECRET;
    } else {
      process.env.LEGAL_CONSENT_SECRET = previousSecret;
    }
  }
});

test("recordLegalAcceptance persists verified consent and rejects invalid tokens", async () => {
  const previousSecret = process.env.LEGAL_CONSENT_SECRET;
  process.env.LEGAL_CONSENT_SECRET = TEST_SECRET;
  const inserts: Record<string, unknown>[] = [];
  const supabase = {
    from(relation: string) {
      assert.equal(relation, "user_legal_acceptances");
      return {
        insert(values: Record<string, unknown>) {
          inserts.push(values);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  try {
    const token = createLegalConsentToken("google_oauth");
    await recordLegalAcceptance({ supabase, userId: "user-123", token });

    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.user_id, "user-123");
    assert.equal(inserts[0]?.acceptance_method, "google_oauth");
    await assert.rejects(
      recordLegalAcceptance({ supabase, userId: "user-123", token: "invalid" }),
      /invalid or expired/i,
    );
    assert.equal(inserts.length, 1);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.LEGAL_CONSENT_SECRET;
    } else {
      process.env.LEGAL_CONSENT_SECRET = previousSecret;
    }
  }
});

test("signup UI and server action both require legal consent", () => {
  const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
  const loginActions = readFileSync("src/app/login/actions.ts", "utf8");
  const googleButton = readFileSync(
    "src/app/login/GoogleSignInButton.tsx",
    "utf8",
  );

  assert.match(loginPage, /name="legalConsent"/);
  assert.match(loginPage, /type="checkbox"/);
  assert.match(loginPage, /required/);
  assert.match(loginActions, /formData\.get\("legalConsent"\) === "on"/);
  assert.match(loginActions, /if \(!legalConsentAccepted\)/);
  assert.match(googleButton, /if \(!checkbox\?\.checked\)/);
  assert.match(googleButton, /fetch\("\/auth\/legal-consent"/);
});

test("acceptance migration creates immutable self-scoped records", () => {
  const migration = readFileSync(
    "supabase/migrations/20260809144209_user_legal_acceptances.sql",
    "utf8",
  );
  const grantsHardening = readFileSync(
    "supabase/migrations/20260809144314_user_legal_acceptances_grants_hardening.sql",
    "utf8",
  );

  assert.match(migration, /create table if not exists public\.user_legal_acceptances/);
  assert.match(migration, /unique \(user_id, terms_version, privacy_version\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /revoke insert, update, delete, truncate/);
  assert.doesNotMatch(migration, /grant select, insert/);
  assert.match(grantsHardening, /revoke all privileges[^]*from anon/);
  assert.match(
    grantsHardening,
    /revoke insert, update, delete, truncate, references, trigger[^]*authenticated/,
  );
  assert.match(grantsHardening, /grant select[^]*to authenticated/);
});
