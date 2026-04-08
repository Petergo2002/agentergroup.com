import assert from "node:assert/strict";
import test from "node:test";
import { SafeFetchError, fetchSafeRemoteResource } from "../../src/lib/safe-fetch.ts";

test("blocks metadata service SSRF targets before fetching", async () => {
  let fetchCalled = false;

  await assert.rejects(
    fetchSafeRemoteResource("http://169.254.169.254/latest/meta-data/", {
      fetchImpl: async () => {
        fetchCalled = true;
        throw new Error("fetch should not run for blocked metadata IPs");
      },
    }),
    (error) => {
      assert.equal(fetchCalled, false);
      assert.ok(error instanceof SafeFetchError);
      assert.equal(error.code, "PRIVATE_ADDRESS_BLOCKED");
      return true;
    },
  );
});
