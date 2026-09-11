import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicWidgetRateLimitContext,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
  type RateLimitRule,
} from "../../src/lib/rate-limit.ts";

interface RpcCall {
  scopeKind: string;
  endpoint: string;
  startedAt: number;
}

/**
 * Records call order and concurrency so the enforcement strategy itself can be
 * asserted, not just its verdict.
 */
function createRpcStub(
  verdicts: Record<string, { allowed: boolean; retry_after_seconds?: number }>,
  delayMs = 0,
) {
  const calls: RpcCall[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  return {
    calls,
    get maxConcurrency() {
      return maxInFlight;
    },
    client: {
      async rpc<TData>(_fn: string, args?: Record<string, unknown>) {
        const scopeKind = String(args?.p_scope_kind);
        calls.push({
          scopeKind,
          endpoint: String(args?.p_endpoint),
          startedAt: Date.now(),
        });
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        inFlight -= 1;

        const verdict = verdicts[scopeKind] ?? { allowed: true };
        return {
          data: [
            {
              allowed: verdict.allowed,
              retry_after_seconds: verdict.retry_after_seconds ?? 30,
              limit_value: 10,
              hit_count: 11,
              remaining: 0,
            },
          ] as TData,
          error: null,
        };
      },
    },
  };
}

const chatRules = (): RateLimitRule[] =>
  getPublicWidgetRateLimitRules(
    "chat",
    buildPublicWidgetRateLimitContext({
      request: new Request("https://example.com", {
        headers: { "x-vercel-forwarded-for": "203.0.113.9" },
      }) as never,
      widgetId: "widget-1",
      sessionId: "session-1",
    }),
  );

test("widget chat consumes its scopes concurrently, not one round trip each", async () => {
  const rules = chatRules();
  assert.equal(rules.length, 3, "chat should carry three independent scopes");

  const stub = createRpcStub({}, 20);
  const decision = await enforceRateLimits(stub.client, rules);

  assert.equal(decision.allowed, true);
  assert.equal(stub.calls.length, 3);
  // maxConcurrency is the actual proof of concurrency: it is 3 only if all
  // three calls overlapped, and 1 under serial execution. A wall-clock bound
  // used to be asserted alongside it, but it restated the same fact more
  // weakly and failed whenever a loaded machine stretched three 20ms timers
  // past the threshold.
  assert.equal(stub.maxConcurrency, 3, "all three rules should be in flight together");
});

test("the denying rule and its payload match the sequential behaviour", async () => {
  const rules = chatRules();
  // Deny the second and third rules; the first matching rule in order must win.
  const stub = createRpcStub({
    widget_ip: { allowed: false, retry_after_seconds: 42 },
    widget_session: { allowed: false, retry_after_seconds: 7 },
  });

  const decision = await enforceRateLimits(stub.client, rules);

  assert.equal(decision.allowed, false);
  assert.equal(decision.scopeKind, "widget_ip");
  assert.equal(decision.retryAfterSeconds, 42);
  assert.equal(decision.code, rules[1].code);
  assert.equal(decision.message, rules[1].message);
});

test("a denial still wins over an error in a later rule", async () => {
  const rules = chatRules();
  const failing = {
    async rpc<TData>(_fn: string, args?: Record<string, unknown>) {
      const scopeKind = String(args?.p_scope_kind);
      if (scopeKind === "widget_session") {
        throw new Error("connection reset");
      }
      return {
        data: [
          {
            allowed: scopeKind !== "ip_global",
            retry_after_seconds: 15,
            limit_value: 10,
            hit_count: 11,
            remaining: 0,
          },
        ] as TData,
        error: null,
      };
    },
  };

  // ip_global denies and is ordered first, so it must be returned rather than
  // the later rule's rejection bubbling up as a 500.
  const decision = await enforceRateLimits(failing, rules);
  assert.equal(decision.allowed, false);
  assert.equal(decision.scopeKind, "ip_global");
});

test("an error in an allowed run still surfaces", async () => {
  const rules = chatRules();
  const failing = {
    async rpc<TData>(_fn: string, args?: Record<string, unknown>) {
      if (String(args?.p_scope_kind) === "widget_session") {
        return { data: null, error: { message: "rpc exploded" } };
      }
      return {
        data: [
          { allowed: true, retry_after_seconds: 0, limit_value: 10, hit_count: 1, remaining: 9 },
        ] as TData,
        error: null,
      };
    },
  };

  await assert.rejects(
    () => enforceRateLimits(failing, rules),
    /rpc exploded/,
  );
});
