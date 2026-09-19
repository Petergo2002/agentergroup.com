import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/ui/Modal.tsx", "utf8");
const appShell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
const toasts = readFileSync("src/components/ui/ToastProvider.tsx", "utf8");
const login = readFileSync("src/app/login/page.tsx", "utf8");
const forgotPassword = readFileSync(
  "src/app/login/forgot-password/page.tsx",
  "utf8",
);
const loginLayout = readFileSync("src/app/login/layout.tsx", "utf8");
const forgotPasswordLayout = readFileSync(
  "src/app/login/forgot-password/layout.tsx",
  "utf8",
);
const completeSignup = readFileSync("src/app/complete-signup/page.tsx", "utf8");
const confirmSimpleModal = readFileSync(
  "src/components/modals/ConfirmSimpleModal.tsx",
  "utf8",
);

test("the shared modal exposes dialog semantics and manages keyboard focus", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby=\{titleId\}/);
  assert.match(modal, /event\.key !== 'Tab'/);
  assert.match(modal, /previouslyFocused\.focus\(\)/);
  assert.match(modal, /previousBodyOverflow/);
});

test("the closed mobile navigation is removed from focus and accessibility trees", () => {
  assert.match(appShell, /aria-hidden=\{!isSidebarOpen\}/);
  assert.match(appShell, /inert=\{!isSidebarOpen\}/);
});

test("toast outcomes are announced without making every notice assertive", () => {
  assert.match(
    toasts,
    /role=\{toast\.type === 'error' \? 'alert' : 'status'\}/,
  );
  assert.match(toasts, /aria-atomic="true"/);
});

test("public authentication forms have a primary heading and named recovery input", () => {
  assert.match(login, /<h1/);
  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(forgotPassword, /<h1/);
  assert.doesNotMatch(forgotPassword, /<h2/);
  assert.match(forgotPassword, /htmlFor="recovery-email"/);
  assert.match(forgotPassword, /id="recovery-email"/);
  assert.match(forgotPassword, /name="email"/);
  assert.match(forgotPassword, /autoComplete="email"/);
  assert.match(forgotPassword, /role="alert"/);
  assert.match(forgotPassword, /role="status"/);
  assert.match(loginLayout, /title: "Sign in or sign up"/);
  assert.match(forgotPasswordLayout, /title: "Reset your password"/);
});

test("finishing signup can be completed and saved by a password manager", () => {
  // The two password fields carried no autoComplete, so a manager had nothing
  // to offer to fill and nothing to prompt to save — people set a password
  // here and then could not sign back in with it.
  const newPasswordFields = completeSignup.match(/autoComplete="new-password"/g);
  assert.equal(newPasswordFields?.length, 2, "both password fields must be marked");
  assert.match(completeSignup, /autoComplete="name"/);
  assert.match(completeSignup, /autoComplete="organization"/);

  // A saved password is filed under a username. This screen arrives from an
  // email link with no email field, so one is supplied for the browser only.
  assert.match(completeSignup, /autoComplete="username"/);
  const anchor = completeSignup.slice(
    completeSignup.indexOf('autoComplete="username"') - 200,
    completeSignup.indexOf('autoComplete="username"') + 200,
  );
  assert.match(anchor, /readOnly/);
  assert.match(anchor, /tabIndex=\{-1\}/);
  assert.doesNotMatch(anchor, /name="/, "the hint field must stay out of the submission");
});

test("every field on the signup form is reachable by clicking its label", () => {
  for (const id of ["full-name", "company-name", "new-password", "confirm-password"]) {
    assert.match(completeSignup, new RegExp(`htmlFor="${id}"`), `no label for ${id}`);
    assert.match(completeSignup, new RegExp(`id="${id}"`), `no field ${id}`);
  }
});

test("a confirmation dialog states its question once", () => {
  // Modal renders `title` in its own header, so a body heading printed it
  // twice — the delete dialog read its own name back at you.
  assert.match(confirmSimpleModal, /<Modal isOpen=\{isOpen\} onClose=\{onClose\} title=\{title\}>/);
  const body = confirmSimpleModal.slice(confirmSimpleModal.indexOf("<Modal"));
  assert.doesNotMatch(body, /<h[1-6][^>]*>\s*\{title\}/);
});
