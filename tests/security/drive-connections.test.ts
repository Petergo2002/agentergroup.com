import assert from "node:assert/strict";
import test from "node:test";
import {
  getDriveComposioUserId,
  getDriveConnectedAccountId,
  resolveDriveConnection,
} from "../../src/lib/drive-connections.ts";

const connections = [
  {
    id: "conn-a",
    status: "connected",
    external_id: "acct-a",
    toolkit_data: {
      composioUserId: "workspace:one",
    },
  },
  {
    id: "conn-b",
    status: "connected",
    external_id: "acct-b",
    toolkit_data: {
      composioUserId: "workspace:one",
    },
  },
];

test("requires explicit Drive connection selection when multiple accounts are connected", () => {
  assert.throws(
    () => resolveDriveConnection(connections),
    /Select a Google Drive account before browsing files\./,
  );
});

test("returns the requested Drive connection and extracts the connected account id", () => {
  const selected = resolveDriveConnection(connections, "conn-b");

  assert.equal(selected.id, "conn-b");
  assert.equal(getDriveConnectedAccountId(selected), "acct-b");
  assert.equal(getDriveComposioUserId(selected), "workspace:one");
});
