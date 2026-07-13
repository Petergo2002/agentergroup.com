import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  InvalidJsonBodyError,
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "../../src/lib/bounded-json.ts";
import {
  MAX_KNOWLEDGE_TEXT_SOURCE_BYTES,
  validateKnowledgeText,
} from "../../src/lib/knowledge-text.ts";

const editRoute = readFileSync(
  "src/app/api/knowledge/sources/[id]/route.ts",
  "utf8",
);
const createRoute = readFileSync(
  "src/app/api/knowledge/sources/route.ts",
  "utf8",
);
const flywheelServer = readFileSync("src/lib/flywheel/server.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260713183356_atomic_knowledge_text_updates.sql",
  "utf8",
);

test("knowledge text validation uses exact UTF-8 bytes and rejects empty input", () => {
  assert.equal(validateKnowledgeText(null).valid, false);
  assert.equal(validateKnowledgeText("   \n").valid, false);

  const exactBoundary = "😀".repeat(MAX_KNOWLEDGE_TEXT_SOURCE_BYTES / 4);
  const accepted = validateKnowledgeText(exactBoundary);
  assert.equal(accepted.valid, true);
  if (accepted.valid) {
    assert.equal(accepted.sizeBytes, MAX_KNOWLEDGE_TEXT_SOURCE_BYTES);
  }

  const rejected = validateKnowledgeText(`${exactBoundary}a`);
  assert.equal(rejected.valid, false);
  if (!rejected.valid) {
    assert.equal(rejected.code, "too_large");
  }
});

test("bounded JSON rejects declared and streamed bodies over the limit", async () => {
  const declared = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": "11" },
    body: "{}",
  });
  await assert.rejects(
    readJsonBodyWithLimit(declared, 10),
    RequestBodyTooLargeError,
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(new TextEncoder().encode("too-large"));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    },
  });
  const streamed = new Request("https://example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(
    readJsonBodyWithLimit(streamed, 12),
    RequestBodyTooLargeError,
  );
});

test("bounded JSON accepts valid objects and rejects malformed JSON", async () => {
  const valid = new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ rawText: "hello" }),
  });
  assert.deepEqual(await readJsonBodyWithLimit(valid, 100), {
    rawText: "hello",
  });

  const invalid = new Request("https://example.test", {
    method: "POST",
    body: "{not-json",
  });
  await assert.rejects(readJsonBodyWithLimit(invalid, 100), InvalidJsonBodyError);
});

test("knowledge edits use the atomic RPC and authenticated Edge invocation", () => {
  assert.doesNotMatch(editRoute, /headers\.get\(["']origin["']\)/i);
  assert.doesNotMatch(editRoute, /safeInternalFetch/);
  assert.doesNotMatch(editRoute, /\/api\/knowledge\/sources\/\$\{[^}]+\}\/process/);
  assert.match(editRoute, /readJsonBodyWithLimit/);
  assert.match(editRoute, /validateKnowledgeText/);
  assert.match(editRoute, /\.rpc\("update_knowledge_source_text"/);
  assert.match(
    editRoute,
    /functions\.invoke\([\s\S]*"process-knowledge-source"[\s\S]*Authorization: `Bearer \$\{session\.access_token\}`/,
  );
  assert.match(
    editRoute,
    /latestSource\?\.status === "processing"[\s\S]*status: "failed"/,
  );
});

test("all application knowledge writes use server-side clients or the atomic RPC", () => {
  assert.match(createRoute, /const admin = createAdminClient\(\)/);
  assert.match(createRoute, /await admin[\s\S]*\.from\("knowledge_sources"\)/);
  assert.match(flywheelServer, /\.rpc\("update_knowledge_source_text"/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/);
  assert.match(migration, /octet_length\(p_raw_text\)/);
  assert.match(migration, /resolved_status = 'processing'/);
  assert.match(migration, /status = 'processing'/);
});
