import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrapSource = readFileSync("src/lib/app/bootstrap.ts", "utf8");
const themeProviderSource = readFileSync(
  "src/components/theme/ThemeProvider.tsx",
  "utf8",
);

test("workspace context bootstrap enforces sequential profile sync before workspace creation", () => {
  // Must NOT run syncUserProfile and getOrCreateUserWorkspaces concurrently in Promise.all
  assert.doesNotMatch(
    bootstrapSource,
    /Promise\.all\(\[\s*syncUserProfile[\s\S]*getOrCreateUserWorkspaces/,
    "Promise.all must not execute profile sync and workspace creation in parallel",
  );

  // Must sequentially await syncUserProfile before getOrCreateUserWorkspaces
  const syncProfileIndex = bootstrapSource.indexOf("const profile = await syncUserProfile(");
  const getWorkspacesIndex = bootstrapSource.indexOf("const workspaces = await getOrCreateUserWorkspaces(");

  assert.ok(syncProfileIndex !== -1, "syncUserProfile must be awaited");
  assert.ok(getWorkspacesIndex !== -1, "getOrCreateUserWorkspaces must be awaited");
  assert.ok(
    syncProfileIndex < getWorkspacesIndex,
    "syncUserProfile must be executed before getOrCreateUserWorkspaces to satisfy foreign key constraints",
  );
});

test("workspace creation helpers proactively ensure profile existence against 23503 violations", () => {
  assert.match(
    bootstrapSource,
    /createWorkspaceForUser[\s\S]*await syncUserProfile\(supabase, user\)/,
    "createWorkspaceForUser must proactively sync profile before workspace creation",
  );
  assert.match(
    bootstrapSource,
    /createPrimaryWorkspaceForUser[\s\S]*await syncUserProfile\(supabase, user\)/,
    "createPrimaryWorkspaceForUser must proactively sync profile before primary workspace creation",
  );
});

test("ThemeProvider suppresses benign React 19 script tag console warnings", () => {
  assert.match(
    themeProviderSource,
    /Encountered a script tag/,
    "ThemeProvider should filter out the benign next-themes script tag warning in development",
  );
});
