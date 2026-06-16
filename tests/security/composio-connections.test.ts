import assert from "node:assert/strict";
import test from "node:test";
import {
  listCalEventTypesWithExecutor,
} from "../../src/lib/cal-event-types.ts";
import {
  isComposioAuthenticationError,
  isConnectedAccountMissingError,
} from "../../src/lib/composio-errors.ts";
import { assertComposioToolCallRuntime } from "../../src/lib/composio-tool-runtime.ts";

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

test("detects invalid Composio API key responses", () => {
  const error = new Error(
    '401 {"error":{"message":"Invalid API key: ak_****","code":10401,"slug":"HTTP_Unauthorized","status":401}}',
  );

  assert.equal(isComposioAuthenticationError(error), true);
  assert.equal(isConnectedAccountMissingError(error), false);
});

test("Cal.com event-type listing rethrows stale connected-account errors", async () => {
  const error = new Error("Error executing the tool CAL_LIST_EVENT_TYPES", {
    cause: {
      error: {
        slug: "ActionExecute_ConnectedAccountNotFound",
        message:
          "Connected account 'ca_stale' was not found or may have been deleted.",
      },
    },
  });

  await assert.rejects(
    () =>
      listCalEventTypesWithExecutor(
        async () => {
          throw error;
        },
        "workspace:one",
        "ca_stale",
        isConnectedAccountMissingError,
      ),
    (thrown) => thrown === error,
  );
});

test("Cal.com event-type listing still falls back to empty list for non-stale errors", async () => {
  const eventTypes = await listCalEventTypesWithExecutor(
    async () => {
      throw new Error("Cal.com returned a transient upstream error.");
    },
    "workspace:one",
    "ca_transient",
    isConnectedAccountMissingError,
  );

  assert.deepEqual(eventTypes, []);
});

test("Composio tool-call setup failures throw instead of returning empty results", async () => {
  assert.throws(
    () =>
      assertComposioToolCallRuntime({
        hasClient: false,
        hasSession: true,
        hasProvider: true,
        userId: "workspace:one",
      }),
    /provider API key is missing/,
  );

  assert.throws(
    () =>
      assertComposioToolCallRuntime({
        hasClient: true,
        hasSession: false,
        hasProvider: true,
        userId: "workspace:one",
      }),
    /No connection provider session is available/,
  );

  assert.throws(
    () =>
      assertComposioToolCallRuntime({
        hasClient: true,
        hasSession: true,
        hasProvider: false,
        userId: "workspace:one",
      }),
    /Connection provider is unavailable/,
  );
});
