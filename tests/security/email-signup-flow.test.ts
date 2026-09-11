import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAuthConfirmationDestination } from "../../src/lib/auth-confirmation.ts";

const ORIGIN = "https://avenro.se";

test("email signup confirmations go directly to onboarding without leaking consent", () => {
  const current = resolveAuthConfirmationDestination(
    "/onboarding?legalConsent=signed-token",
    ORIGIN,
  );
  assert.equal(current.isEmailSignupConfirmation, true);
  assert.equal(current.legalConsent, "signed-token");
  assert.equal(current.redirectTo.toString(), `${ORIGIN}/onboarding`);

  const legacy = resolveAuthConfirmationDestination(
    "/complete-signup?legalConsent=signed-token&redirectTo=%2Fdashboard",
    ORIGIN,
  );
  assert.equal(legacy.isEmailSignupConfirmation, true);
  assert.equal(legacy.redirectTo.toString(), `${ORIGIN}/onboarding`);
});

test("non-signup confirmation destinations remain unchanged", () => {
  const result = resolveAuthConfirmationDestination(
    "/settings?section=profile",
    ORIGIN,
  );
  assert.equal(result.isEmailSignupConfirmation, false);
  assert.equal(
    result.redirectTo.toString(),
    `${ORIGIN}/settings?section=profile`,
  );
});

test("password signup ends on a dedicated email verification screen", () => {
  const actions = readFileSync("src/app/login/actions.ts", "utf8");
  const confirmRoute = readFileSync("src/app/auth/confirm/route.ts", "utf8");
  const completeSignupPage = readFileSync(
    "src/app/complete-signup/page.tsx",
    "utf8",
  );
  const verifyPage = readFileSync("src/app/verify-email/page.tsx", "utf8");
  const proxy = readFileSync("src/lib/supabase/proxy.ts", "utf8");

  assert.match(actions, /supabase\.auth\.signUp\(\{/);
  assert.match(actions, /email,\s*password,/);
  assert.match(actions, /`\/onboarding\?legalConsent=/);
  assert.match(actions, /redirect\("\/verify-email"\)/);
  assert.doesNotMatch(
    actions,
    /buildCompleteSignupRedirectUrl\(\{\s*legalConsent/,
  );

  assert.match(confirmRoute, /resolveAuthConfirmationDestination/);
  assert.match(confirmRoute, /recordLegalAcceptance/);
  assert.match(completeSignupPage, /if \(isLegacyPasswordSignup\)/);
  assert.match(completeSignupPage, /redirect\("\/onboarding"\)/);
  assert.match(proxy, /"\/verify-email"/);
  assert.match(verifyPage, /verifyEmailTitle/);
  assert.doesNotMatch(verifyPage, /type="password"/);
});
