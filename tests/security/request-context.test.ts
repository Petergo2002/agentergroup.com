import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadRequestContext } from "../../src/lib/app/request-context-core.ts";

interface TestUser {
  id: string;
}

interface TestWorkspace {
  id: string;
}

interface TestContext {
  workspace: TestWorkspace;
  workspaces: TestWorkspace[];
}

function createDependencies(input: {
  user: TestUser | null;
  ensureWorkspace: () => Promise<TestContext>;
}) {
  const client = { name: "request-client" };
  let authCalls = 0;
  let workspaceCalls = 0;

  return {
    get authCalls() {
      return authCalls;
    },
    get workspaceCalls() {
      return workspaceCalls;
    },
    dependencies: {
      async createSupabaseClient() {
        return client;
      },
      async getUser() {
        authCalls += 1;
        return input.user;
      },
      async ensureWorkspace() {
        workspaceCalls += 1;
        return input.ensureWorkspace();
      },
    },
  };
}

test("preserves the selected workspace for a user with multiple memberships", async () => {
  const workspaces = [{ id: "workspace-a" }, { id: "workspace-b" }];
  const harness = createDependencies({
    user: { id: "user-1" },
    ensureWorkspace: async () => ({
      workspace: workspaces[1],
      workspaces,
    }),
  });

  const result = await loadRequestContext(harness.dependencies);

  assert.equal(result.user?.id, "user-1");
  assert.equal(result.context?.workspace.id, "workspace-b");
  assert.deepEqual(result.context?.workspaces, workspaces);
  assert.equal(harness.authCalls, 1);
  assert.equal(harness.workspaceCalls, 1);
});

test("returns the workspace created by bootstrap for a user without one", async () => {
  const createdWorkspace = { id: "workspace-created" };
  const harness = createDependencies({
    user: { id: "user-new" },
    ensureWorkspace: async () => ({
      workspace: createdWorkspace,
      workspaces: [createdWorkspace],
    }),
  });

  const result = await loadRequestContext(harness.dependencies);

  assert.equal(result.context?.workspace.id, "workspace-created");
  assert.equal(harness.workspaceCalls, 1);
});

test("does not resolve workspace data for an expired session", async () => {
  const harness = createDependencies({
    user: null,
    ensureWorkspace: async () => {
      throw new Error("workspace bootstrap must not run");
    },
  });

  const result = await loadRequestContext(harness.dependencies);

  assert.equal(result.user, null);
  assert.equal(result.context, null);
  assert.equal(harness.authCalls, 1);
  assert.equal(harness.workspaceCalls, 0);
});

test("workspace switching resolves a fresh context in the next request", async () => {
  let activeWorkspaceId = "workspace-a";
  const buildRequest = () =>
    createDependencies({
      user: { id: "user-1" },
      ensureWorkspace: async () => ({
        workspace: { id: activeWorkspaceId },
        workspaces: [{ id: "workspace-a" }, { id: "workspace-b" }],
      }),
    });

  const firstRequest = buildRequest();
  const firstResult = await loadRequestContext(firstRequest.dependencies);

  activeWorkspaceId = "workspace-b";
  const secondRequest = buildRequest();
  const secondResult = await loadRequestContext(secondRequest.dependencies);

  assert.equal(firstResult.context?.workspace.id, "workspace-a");
  assert.equal(secondResult.context?.workspace.id, "workspace-b");
  assert.equal(firstRequest.workspaceCalls, 1);
  assert.equal(secondRequest.workspaceCalls, 1);
});

test("the App Router wrapper uses React request-scoped cache", () => {
  const source = readFileSync("src/lib/app/request-context.ts", "utf8");

  assert.match(source, /import \{ cache \} from "react"/);
  assert.match(source, /export const getAppRequestContext = cache\(loadAppRequestContext\)/);
  assert.doesNotMatch(source, /unstable_cache/);
});
