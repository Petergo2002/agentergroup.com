import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rate-limit HMAC secret does not use Supabase service role fallback", () => {
  const source = readFileSync("src/lib/env.ts", "utf8");
  const start = source.indexOf("export function getRateLimitSecret");
  const end = source.indexOf("export function getTrustedProxySecret", start);
  const body = source.slice(start, end === -1 ? undefined : end);

  assert.match(body, /RATE_LIMIT_SECRET is missing/);
  assert.doesNotMatch(body, /getSupabaseServiceRoleKey|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Stripe billing config requires env vars without hardcoded price fallbacks", () => {
  const source = readFileSync("src/lib/stripe.ts", "utf8");

  assert.match(source, /BillingConfigurationError/);
  assert.match(source, /NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID/);
  assert.match(source, /NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID/);
  assert.match(source, /STRIPE_EXTRA_CREDITS_500_PRICE_ID/);
  assert.doesNotMatch(source, /price_1[A-Za-z0-9]+/);
});
