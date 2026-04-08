import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkspaceAccessError,
  assertOwnedWorkspaceResource,
} from "../../src/lib/workspace-security.ts";

test("rejects resources owned by a different workspace", () => {
  assert.throws(
    () =>
      assertOwnedWorkspaceResource(
        { workspace_id: "workspace-b" },
        "workspace-a",
        "You do not have access to delete this resource.",
      ),
    (error) => {
      assert.ok(error instanceof WorkspaceAccessError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "You do not have access to delete this resource.");
      return true;
    },
  );
});
