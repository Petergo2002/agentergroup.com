import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("OnboardingContent implements split-view layout with editable name and company details", () => {
  const contentSource = readFileSync(
    "src/app/onboarding/OnboardingContent.tsx",
    "utf8",
  );

  // Verify split-view structure
  assert.match(
    contentSource,
    /flex-col lg:flex-row/,
    "Onboarding must use a responsive split-view flex layout",
  );
  assert.match(
    contentSource,
    /lg:w-1\/2[\s\S]*lg:w-1\/2/,
    "Onboarding must split space evenly between form and visual sections",
  );

  // Verify inputs for Full Name and Company Name
  assert.match(
    contentSource,
    /name="fullName"/,
    "Onboarding must include fullName input for user customization",
  );
  assert.match(
    contentSource,
    /name="companyName"/,
    "Onboarding must include companyName input for workspace customization",
  );

  // Verify Terms of Service and Privacy Policy acceptance
  assert.match(
    contentSource,
    /name="acceptTerms"/,
    "Onboarding must include acceptTerms checkbox when terms are not yet accepted",
  );
  assert.match(
    contentSource,
    /href="\/terms-of-service"/,
    "Onboarding must link to terms of service",
  );
  assert.match(
    contentSource,
    /href="\/privacy-policy"/,
    "Onboarding must link to privacy policy",
  );

  // Verify right-hand Milo hero
  assert.match(
    contentSource,
    /<MiloLogo/,
    "Onboarding must render the hero MiloLogo in the visual column",
  );
  assert.match(
    contentSource,
    /Milo AI Engine/,
    "Onboarding visual column must show Milo AI Engine badge",
  );
});

test("Onboarding server action updates profile, workspace, and records legal consent", () => {
  const actionsSource = readFileSync(
    "src/app/onboarding/actions.ts",
    "utf8",
  );

  assert.match(
    actionsSource,
    /export async function updateOnboardingDetails/,
    "actions.ts must export updateOnboardingDetails server action",
  );
  assert.match(
    actionsSource,
    /\.from\("profiles"\)\s*\.update\(\{\s*full_name:\s*fullName\s*\}\)/,
    "Must update profile full_name",
  );
  assert.match(
    actionsSource,
    /\.from\("workspaces"\)\s*\.update\(\{\s*name:\s*companyName\s*\}\)/,
    "Must update workspace name",
  );
  assert.match(
    actionsSource,
    /recordLegalAcceptance/,
    "Must record legal acceptance when terms are agreed to",
  );
  assert.match(
    actionsSource,
    /invalidateWorkspaceContextCache/,
    "Must invalidate workspace context cache after updating details",
  );
});

test("Onboarding page loads legal acceptance status and forwards all profile props", () => {
  const pageSource = readFileSync(
    "src/app/onboarding/page.tsx",
    "utf8",
  );

  assert.match(
    pageSource,
    /\.from\("user_legal_acceptances"\)/,
    "page.tsx must check user_legal_acceptances table",
  );
  assert.match(
    pageSource,
    /hasAcceptedTerms=\{Boolean\(legalConsent\)\}/,
    "page.tsx must pass hasAcceptedTerms prop to OnboardingContent",
  );
  assert.match(
    pageSource,
    /userEmail=\{user\.email \|\| ""\}/,
    "page.tsx must pass userEmail prop to OnboardingContent",
  );
});
