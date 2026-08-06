import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { workspaceSWRKey } from "../../src/lib/json-fetcher.ts";
import {
  BUILDER_VERSION_LIST_LIMIT,
  WORKSPACE_AGENT_LIST_LIMIT,
  WORKSPACE_ASSISTANT_LIST_LIMIT,
  WORKSPACE_CONNECTION_LIST_LIMIT,
  WORKSPACE_KNOWLEDGE_FOLDER_LIST_LIMIT,
  WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT,
  WORKSPACE_WIDGET_LIST_LIMIT,
} from "../../src/lib/query-limits.ts";

test("authenticated SWR keys are isolated by user and workspace", () => {
  const url = "/api/dashboard/latest-activity";
  const first = workspaceSWRKey("user-a", "workspace-a", url);
  const otherWorkspace = workspaceSWRKey("user-a", "workspace-b", url);
  const otherUser = workspaceSWRKey("user-b", "workspace-a", url);

  assert.deepEqual(first, ["user-a", "workspace-a", url]);
  assert.notDeepEqual(first, otherWorkspace);
  assert.notDeepEqual(first, otherUser);
  assert.equal(workspaceSWRKey("user-a", "workspace-a", null), null);
});

test("every authenticated SWR consumer uses a workspace-qualified key", () => {
  const files = [
    "src/components/layout/AppShell.tsx",
    "src/components/analytics/AnalyticsWorkspaceView.tsx",
    "src/components/leads/LeadsPageClient.tsx",
    "src/app/(app)/questions/QuestionsPageClient.tsx",
    "src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /workspaceSWRKey\(/, `${file} must use a tenant-safe key`);
  }

  const appShell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
  assert.match(appShell, /key=\{`\$\{user\.id\}:\$\{context\.workspace\.id\}`\}/);
});

test("workspace list limits are conservative positive bounds", () => {
  const limits = [
    WORKSPACE_AGENT_LIST_LIMIT,
    WORKSPACE_WIDGET_LIST_LIMIT,
    WORKSPACE_CONNECTION_LIST_LIMIT,
    WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT,
    WORKSPACE_KNOWLEDGE_FOLDER_LIST_LIMIT,
    BUILDER_VERSION_LIST_LIMIT,
    WORKSPACE_ASSISTANT_LIST_LIMIT,
  ];

  assert.ok(limits.every((limit) => Number.isInteger(limit) && limit >= 100));
  assert.ok(limits.every((limit) => limit <= 500));
});

test("top-level workspace list queries apply the defensive bounds", () => {
  const contracts: Array<[string, RegExp]> = [
    ["src/app/(app)/agents/page.tsx", /\.limit\(WORKSPACE_AGENT_LIST_LIMIT\)/],
    ["src/lib/widgets/loader.ts", /\.limit\(WORKSPACE_WIDGET_LIST_LIMIT\)/],
    [
      "src/app/(app)/knowledge/page.tsx",
      /\.limit\(WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT\)/,
    ],
    [
      "src/app/(app)/connections/page.tsx",
      /\.limit\(WORKSPACE_CONNECTION_LIST_LIMIT\)/,
    ],
    [
      "src/lib/agents/builder-bootstrap.ts",
      /\.limit\(BUILDER_VERSION_LIST_LIMIT\)/,
    ],
    [
      "src/lib/assistants/server.ts",
      /\.limit\(WORKSPACE_ASSISTANT_LIST_LIMIT\)/,
    ],
  ];

  for (const [file, pattern] of contracts) {
    assert.match(readFileSync(file, "utf8"), pattern, `${file} must remain bounded`);
  }
});
