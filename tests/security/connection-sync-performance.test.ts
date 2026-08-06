import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConnectionSyncRows,
  persistConnectionSyncRows,
} from "../../src/lib/connection-sync.ts";
import { shouldRefreshConnections } from "../../src/lib/connections.ts";

test("connection snapshots are tenant-scoped and persisted in one batch", async () => {
  const rows = buildConnectionSyncRows(
    [
      {
        toolkitSlug: "gmail",
        displayName: "Gmail",
        status: "connected",
        externalId: "account-gmail",
        accountLabel: "Work",
        toolkitData: { composioUserId: "workspace:workspace-a" },
      },
      {
        toolkitSlug: "slack",
        displayName: "Slack",
        status: "connected",
        externalId: "account-slack",
        toolkitData: { composioUserId: "workspace:workspace-a" },
      },
    ],
    {
      workspaceId: "workspace-a",
      userId: "user-a",
      syncedAt: "2026-08-05T12:00:00.000Z",
    },
  );
  let upsertCalls = 0;

  await persistConnectionSyncRows(rows, async (batch) => {
    upsertCalls += 1;
    assert.equal(batch.length, 2);
    assert.ok(batch.every((row) => row.workspace_id === "workspace-a"));
    assert.ok(batch.every((row) => row.created_by === "user-a"));
    return { error: null };
  });

  assert.equal(upsertCalls, 1);
  assert.equal(rows[1].account_label, "default");
});

test("connection batch persistence surfaces database errors", async () => {
  const rows = buildConnectionSyncRows(
    [
      {
        toolkitSlug: "gmail",
        displayName: "Gmail",
        status: "connected",
        externalId: "account-gmail",
        toolkitData: {},
      },
    ],
    {
      workspaceId: "workspace-a",
      userId: "user-a",
      syncedAt: "2026-08-05T12:00:00.000Z",
    },
  );

  await assert.rejects(
    () =>
      persistConnectionSyncRows(rows, async () => ({
        error: { message: "upsert failed" },
      })),
    /upsert failed/,
  );
});

test("connection refresh runs for missing or stale snapshots only", () => {
  const now = Date.parse("2026-08-05T12:01:00.000Z");

  assert.equal(shouldRefreshConnections([], { now }), true);
  assert.equal(
    shouldRefreshConnections([{ last_synced_at: null }], { now }),
    true,
  );
  assert.equal(
    shouldRefreshConnections(
      [{ last_synced_at: "2026-08-05T12:00:30.000Z" }],
      { now },
    ),
    false,
  );
  assert.equal(
    shouldRefreshConnections(
      [{ last_synced_at: "2026-08-05T11:59:59.000Z" }],
      { now },
    ),
    true,
  );
});

test("initial page HTML uses stored connection snapshots without blocking sync", () => {
  const connectionsPage = readFileSync(
    "src/app/(app)/connections/page.tsx",
    "utf8",
  );
  const knowledgePage = readFileSync(
    "src/app/(app)/knowledge/page.tsx",
    "utf8",
  );
  const builderBootstrap = readFileSync(
    "src/lib/agents/builder-bootstrap.ts",
    "utf8",
  );
  const connectionsClient = readFileSync(
    "src/app/(app)/connections/ConnectionsPageClient.tsx",
    "utf8",
  );

  assert.doesNotMatch(connectionsPage, /syncConnectedAccountsToDatabase/);
  assert.doesNotMatch(knowledgePage, /syncConnectedAccountsToDatabase/);
  assert.doesNotMatch(builderBootstrap, /syncConnectedAccountsToDatabase/);
  assert.match(connectionsClient, /useEffect\(\(\) =>/);
  assert.match(connectionsClient, /shouldRefreshConnections\(initialConnections\)/);
  assert.match(connectionsClient, /void load\(\)/);
});
