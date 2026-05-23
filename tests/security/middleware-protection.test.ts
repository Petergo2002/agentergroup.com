import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("middleware protects matched routes by default", () => {
  const source = readFileSync("src/lib/supabase/proxy.ts", "utf8");

  assert.doesNotMatch(source, /!\s*isProtectedPath/);
  assert.match(source, /All other matched routes require authentication by default/);
  assert.match(source, /PUBLIC_EXACT_PATHS/);
  assert.match(source, /PUBLIC_PATH_PREFIXES/);
});

test("unauthenticated webhook routes remain explicitly public", () => {
  const source = readFileSync("src/lib/supabase/proxy.ts", "utf8");

  assert.match(source, /\/api\/billing\/webhook/);
  assert.match(source, /\/api\/composio\/webhook/);
  assert.match(source, /\/api\/internal\/privacy\/retention/);
});
