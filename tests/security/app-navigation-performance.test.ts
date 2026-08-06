import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSwitcher = readFileSync(
  "src/components/layout/WorkspaceSwitcher.tsx",
  "utf8",
);
const createWorkspaceModal = readFileSync(
  "src/components/modals/CreateWorkspaceModal.tsx",
  "utf8",
);
const settingsPage = readFileSync(
  "src/app/(app)/settings/page.tsx",
  "utf8",
);
const teamPage = readFileSync(
  "src/app/(app)/settings/team/page.tsx",
  "utf8",
);
const activeWorkspaceRoute = readFileSync(
  "src/app/api/workspaces/active/route.ts",
  "utf8",
);

test("workspace mutations preserve the App Router shell", () => {
  for (const source of [workspaceSwitcher, createWorkspaceModal, settingsPage]) {
    assert.doesNotMatch(source, /window\.location\.(assign|href)/);
    assert.match(source, /router\.replace\('\/dashboard'\)/);
    assert.match(source, /router\.refresh\(\)/);
  }

  assert.match(workspaceSwitcher, /router\.push\('\/settings\/billing'\)/);
  assert.match(teamPage, /router\.push\(`\/invite\/accept\?token=/);
});

test("workspace switching remains server-authorized and cookie-backed", () => {
  assert.match(workspaceSwitcher, /fetch\('\/api\/workspaces\/active'/);
  assert.match(activeWorkspaceRoute, /context\.workspaces\.find/);
  assert.match(activeWorkspaceRoute, /status: 403/);
  assert.match(activeWorkspaceRoute, /response\.cookies\.set\("active_workspace_id"/);
  assert.match(activeWorkspaceRoute, /httpOnly: true/);
});

test("external billing redirects remain document navigations", () => {
  const billingPage = readFileSync(
    "src/app/(app)/settings/billing/page.tsx",
    "utf8",
  );

  assert.match(billingPage, /window\.location\.href = data\.url/);
});
