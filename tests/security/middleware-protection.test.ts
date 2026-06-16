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

  assert.match(source, /\/api\/health/);
  assert.match(source, /\/api\/billing\/webhook/);
  assert.match(source, /\/api\/composio\/webhook/);
  assert.match(source, /\/api\/internal\/privacy\/retention/);
});

test("public health endpoint is non-secret and no-store", () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");

  assert.match(source, /ok: true/);
  assert.match(source, /service: "agentergroup-web"/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(source, /SUPABASE|SERVICE_ROLE|SECRET|API_KEY|OPENROUTER|COMPOSIO|STRIPE/);
});

test("invite accept routes stay public but route handlers enforce auth", () => {
  const source = readFileSync("src/lib/supabase/proxy.ts", "utf8");
  const acceptRouteSource = readFileSync("src/app/api/invites/accept/route.ts", "utf8");

  assert.match(source, /"\/invite"/);
  assert.match(source, /"\/api\/invites"/);
  assert.match(acceptRouteSource, /if \(!user\)/);
  assert.match(acceptRouteSource, /status: 401/);
});
