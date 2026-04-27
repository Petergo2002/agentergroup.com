import assert from "node:assert/strict";
import test from "node:test";
import {
  BillingAuthorizationError,
  assertWorkspaceBillingAdmin,
  isBillingAdminRole,
  type BillingAuthorizationClient,
} from "../../src/lib/billing-authorization.ts";

function buildBillingClient(role: string | null, error: { message?: string } | null = null) {
  const calls: Array<[string, string]> = [];
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: string) {
      calls.push([column, value]);
      return query;
    },
    async single() {
      return {
        data: role ? { role } : null,
        error,
      };
    },
  };

  return {
    calls,
    client: {
      from(table: "workspace_members") {
        assert.equal(table, "workspace_members");
        return query;
      },
    } satisfies BillingAuthorizationClient,
  };
}

test("billing admin roles are limited to owner and admin", () => {
  assert.equal(isBillingAdminRole("owner"), true);
  assert.equal(isBillingAdminRole("admin"), true);
  assert.equal(isBillingAdminRole("member"), false);
  assert.equal(isBillingAdminRole(null), false);
});

test("billing authorization scopes membership lookup to workspace and user", async () => {
  const { client, calls } = buildBillingClient("admin");

  await assertWorkspaceBillingAdmin(client, "workspace-a", "user-a");

  assert.deepEqual(calls, [
    ["workspace_id", "workspace-a"],
    ["user_id", "user-a"],
  ]);
});

test("billing authorization rejects non-admin workspace members", async () => {
  const { client } = buildBillingClient("member");

  await assert.rejects(
    () => assertWorkspaceBillingAdmin(client, "workspace-a", "user-a"),
    BillingAuthorizationError,
  );
});

test("billing authorization rejects missing cross-workspace membership", async () => {
  const { client } = buildBillingClient(null);

  await assert.rejects(
    () => assertWorkspaceBillingAdmin(client, "workspace-b", "user-a"),
    BillingAuthorizationError,
  );
});
