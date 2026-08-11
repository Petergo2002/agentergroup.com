import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SafeFetchError,
  fetchSafeDownloadBytes,
  fetchSafeRemoteResource,
} from "../../src/lib/safe-fetch.ts";

const publicLookup = async () => [{ address: "8.8.8.8", family: 4 as const }];

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

test("rejects a declared remote file size before buffering the body", async () => {
  await assert.rejects(
    fetchSafeDownloadBytes("https://storage.googleapis.com/example.pdf", {
      maxBytes: 4,
      lookupImpl: publicLookup as never,
      fetchImpl: async () =>
        new Response(null, {
          headers: { "content-length": "5" },
        }),
    }),
    (error) => {
      assert.ok(error instanceof SafeFetchError);
      assert.equal(error.code, "RESPONSE_TOO_LARGE");
      return true;
    },
  );
});

test("stops a streamed remote file as soon as it crosses the byte limit", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    },
  });

  await assert.rejects(
    fetchSafeDownloadBytes("https://storage.googleapis.com/example.pdf", {
      maxBytes: 3,
      lookupImpl: publicLookup as never,
      fetchImpl: async () => new Response(body),
    }),
    (error) => {
      assert.ok(error instanceof SafeFetchError);
      assert.equal(error.code, "RESPONSE_TOO_LARGE");
      return true;
    },
  );
});

test("returns remote bytes when the response remains within the limit", async () => {
  const bytes = await fetchSafeDownloadBytes(
    "https://storage.googleapis.com/example.pdf",
    {
      maxBytes: 4,
      lookupImpl: publicLookup as never,
      fetchImpl: async () => new Response(new Uint8Array([1, 2, 3, 4])),
    },
  );

  assert.deepEqual(bytes, new Uint8Array([1, 2, 3, 4]));
});

test("turns a stalled remote response into a typed timeout error", async () => {
  await assert.rejects(
    fetchSafeDownloadBytes("https://storage.googleapis.com/example.pdf", {
      maxBytes: 4,
      timeoutMs: 10,
      lookupImpl: publicLookup as never,
      fetchImpl: async (_input, init) => {
        const signal = init?.signal;
        assert.ok(signal);

        return new Promise<Response>((_resolve, reject) => {
          const fallbackTimeout = setTimeout(
            () => reject(new Error("test timeout did not abort the request")),
            100,
          );
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(fallbackTimeout);
              reject(signal.reason);
            },
            { once: true },
          );
        });
      },
    }),
    (error) => {
      assert.ok(error instanceof SafeFetchError);
      assert.equal(error.code, "REQUEST_TIMEOUT");
      return true;
    },
  );
});

test("Drive imports enforce the remaining storage limit without logging signed payloads", () => {
  const source = readFileSync(
    "src/app/api/knowledge/drive/import/route.ts",
    "utf8",
  );

  assert.match(source, /remainingStorageBytes/);
  assert.match(source, /maxBytes/);
  assert.match(source, /DRIVE_DOWNLOAD_TIMEOUT_MS/);
  assert.doesNotMatch(source, /JSON\.stringify\(payload\)/);
  assert.doesNotMatch(source, /URL candidate:[\s\S]*\burl\b/);
});
