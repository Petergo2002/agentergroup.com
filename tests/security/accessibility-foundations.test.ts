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
const dialogFocus = readFileSync("src/lib/hooks/useDialogFocus.ts", "utf8");
const viewSourceModal = readFileSync(
  "src/components/modals/ViewSourceModal.tsx",
  "utf8",
);
const sidebar = readFileSync("src/components/layout/Sidebar.tsx", "utf8");
const tooltip = readFileSync("src/components/ui/Tooltip.tsx", "utf8");
const billing = readFileSync("src/app/(app)/settings/billing/page.tsx", "utf8");
const team = readFileSync("src/app/(app)/settings/team/page.tsx", "utf8");
const sourceTable = readFileSync("src/components/knowledge/SourceTable.tsx", "utf8");
const settings = readFileSync("src/app/(app)/settings/page.tsx", "utf8");
const behaviorTab = readFileSync(
  "src/components/widgets/builder/tabs/BehaviorTab.tsx",
  "utf8",
);

test("the shared modal exposes dialog semantics and manages keyboard focus", () => {
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby=\{titleId\}/);
  // The trap moved into useDialogFocus so a second hand-rolled dialog could
  // share it; the behaviour is asserted against the hook below.
  assert.match(modal, /useDialogFocus\(\{ isOpen, onClose \}\)/);
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

test("every dialog in the app traps focus, not just the shared one", () => {
  // ViewSourceModal rolled its own shell: Escape and a scroll lock, but no
  // focus trap — Tab walked straight out into the page behind it, where the
  // user cannot see what they are focusing.
  for (const marker of [/role="dialog"/, /aria-modal="true"/, /aria-labelledby=/]) {
    assert.match(viewSourceModal, marker);
  }
  assert.match(viewSourceModal, /useDialogFocus\(/);
  assert.match(modal, /useDialogFocus\(/);

  // The trap itself now lives in one place; these are the parts a dialog
  // cannot be missing.
  assert.match(dialogFocus, /event\.key !== 'Tab'/);
  assert.match(dialogFocus, /event\.key === 'Escape'/);
  assert.match(dialogFocus, /previouslyFocused\.focus\(\)/);
  assert.match(dialogFocus, /previousBodyOverflow/);
});

test("nothing falls back to the native confirm dialog", () => {
  // window.confirm cannot be styled or translated, and once someone ticks
  // "prevent this page from creating more dialogs" it silently returns false
  // forever — a destructive action then appears to simply do nothing.
  for (const [name, source] of [
    ["team settings", team],
    ["admin verification", readFileSync(
      "src/app/(admin)/admin/verification/AdminVerificationPageClient.tsx",
      "utf8",
    )],
  ] as const) {
    assert.doesNotMatch(source, /window\.confirm/, `${name} still uses window.confirm`);
    assert.match(source, /useConfirm\(\)/, `${name} has no replacement dialog`);
    assert.match(source, /\{confirmDialog\}/, `${name} never renders the dialog`);
  }
});

test("a keyboard reaches the page without walking the whole sidebar", () => {
  assert.match(appShell, /href="#main-content"/);
  assert.match(appShell, /id="main-content"/);
  // sr-only until focused, or it is a permanently visible link.
  assert.match(appShell, /sr-only focus:not-sr-only/);
  assert.match(sidebar, /<nav\s+aria-label=/);
});

test("table headers say which column they head", () => {
  for (const [name, source] of [
    ["team", team],
    ["billing", billing],
    ["knowledge sources", sourceTable],
  ] as const) {
    const headers = source.match(/<th\b/g) ?? [];
    const scoped = source.match(/<th scope="col"/g) ?? [];
    assert.ok(headers.length > 0, `${name} has no headers to check`);
    assert.equal(scoped.length, headers.length, `${name} has unscoped headers`);
  }
});

test("search fields are search fields", () => {
  // type="search" gives the native clear control and searchbox semantics;
  // a bare text input gives neither.
  for (const [name, path] of [
    ["agents", "src/app/(app)/agents/AgentsPageClient.tsx"],
    ["knowledge", "src/app/(app)/knowledge/KnowledgePageClient.tsx"],
    ["analytics", "src/components/analytics/AnalyticsWorkspaceView.tsx"],
    ["agent library", "src/components/agents/AgentLibraryDialog.tsx"],
  ] as const) {
    assert.match(readFileSync(path, "utf8"), /type="search"/, `${name} search is untyped`);
  }
});

test("a reason for a disabled control is shown, not hidden in a title", () => {
  // A disabled button suppresses pointer events, so a `title` on it is
  // unreliable on hover and absent entirely on touch and keyboard. The
  // wrapper carries the hover instead.
  assert.doesNotMatch(billing, /title=/);
  // Every admin-only control on the page, not just one of them.
  assert.equal(
    (billing.match(/label=\{isAdmin \? null : 'Only workspace admins manage|label=\{isAdmin \? null : 'Only workspace admins can (manage billing|change plans)'\}/g) ?? []).length,
    3,
  );
  assert.equal((billing.match(/<Tooltip/g) ?? []).length, 3);
  assert.match(team, /<Tooltip label=\{inviteDisabledReason\}>/);
  // An absent reason must render the trigger bare rather than an empty bubble.
  assert.match(tooltip, /if \(!label\) return <>\{children\}<\/>;/);
});

test("the settings and widget-behaviour fields are labelled", () => {
  for (const id of [
    "profile-full-name",
    "profile-company-name",
    "workspace-description",
    "privacy-delete-confirmation",
  ]) {
    assert.match(settings, new RegExp(`htmlFor="${id}"`), `no label for ${id}`);
    assert.match(settings, new RegExp(`id="${id}"`), `no field ${id}`);
  }
  // The change-email field has no label element at all, only a placeholder
  // that disappears the moment someone types into it.
  assert.match(settings, /aria-label="Change email address"/);

  for (const id of ["proactive-message", "home-title", "home-subtitle"]) {
    assert.match(behaviorTab, new RegExp(`htmlFor="${id}"`), `no label for ${id}`);
    assert.match(behaviorTab, new RegExp(`id="${id}"`), `no field ${id}`);
  }
});

test("a copy that failed says so instead of claiming success", () => {
  // clipboard.writeText rejects on an insecure origin, an unfocused document
  // or a denied permission. Both call sites used to report success anyway.
  for (const [name, path] of [
    ["connections", "src/app/(app)/connections/ConnectionsPageClient.tsx"],
    ["leads", "src/components/leads/LeadsPageClient.tsx"],
  ] as const) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /copyFailed/, `${name} has no failure path`);
    assert.doesNotMatch(source, /void navigator\.clipboard/, `${name} still fires and forgets`);
  }
});
