import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Composio session caches store timestamps and enforce TTL checks", () => {
  const source = readFileSync("src/lib/composio.ts", "utf8");

  assert.match(source, /CachedComposioSession/);
  assert.match(source, /const SESSION_TTL_MS/);
  assert.match(source, /Date\.now\(\) - cached\.createdAt < SESSION_TTL_MS/);
  assert.match(source, /Date\.now\(\) - cachedToolRouterSession\.createdAt < SESSION_TTL_MS/);
  assert.match(source, /MCP_SESSION_CACHE\.set\(cacheKey,\s*\{\s*value: mcpInfo,\s*createdAt: Date\.now\(\),/s);
});
