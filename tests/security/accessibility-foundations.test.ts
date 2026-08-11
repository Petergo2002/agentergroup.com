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
