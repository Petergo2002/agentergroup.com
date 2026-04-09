import assert from "node:assert/strict";
import test from "node:test";
import { isConnectedAccountMissingError } from "../../src/lib/composio-errors.ts";

test("detects stale connected-account execution errors from nested Composio causes", () => {
  const error = new Error("Error executing the tool GOOGLECALENDAR_LIST_CALENDARS", {
    cause: {
      error: {
        slug: "ActionExecute_ConnectedAccountNotFound",
        message:
          "Connected account 'ca_123' was not found or may have been deleted.",
      },
    },
  });

  assert.equal(isConnectedAccountMissingError(error), true);
});

test("ignores unrelated Composio execution errors", () => {
  const error = new Error("Error executing the tool GOOGLECALENDAR_LIST_CALENDARS", {
    cause: {
      error: {
        slug: "ActionExecute_InvalidInput",
        message: "Required field calendar_id is missing.",
      },
    },
  });

  assert.equal(isConnectedAccountMissingError(error), false);
});
