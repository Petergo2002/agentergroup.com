import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import {
  canAccessWidgetSession,
  hashWidgetVisitorToken,
  normalizeWidgetVisitorToken,
} from "../../src/lib/widgets/visitor.ts";
import { resolveSelectedWidgetAgent } from "../../src/lib/widgets/selection.ts";
import { resolveWidgetAttachmentUrls } from "../../src/lib/widgets/attachment-urls.ts";
import { enforceRateLimits } from "../../src/lib/rate-limit.ts";

/**
 * Behavioural cover for Avenro's widget access-control boundary.
 *
 * The existing widget suites assert that certain lines of source text are
 * present. Those pass whether or not the property they name actually holds.
 * These execute the real functions and assert the security outcome, so they
 * fail if the invariant breaks even when the source still "looks" right.
 */

// ---------------------------------------------------------------------------
// tokens.ts + cors-origin.ts reach @/lib/env, so they are loaded the same way
// the existing credits suite loads the chat route: transpiled into a sandbox
// with the external modules stubbed. Nothing about the token logic is faked.
// ---------------------------------------------------------------------------

const WIDGET_APP_URL = "https://widget.avenro.test";

function loadModule(path: string, extraModules: Record<string, unknown> = {}) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const exportsObject: Record<string, unknown> = {};
  const modules: Record<string, unknown> = {
    "@/lib/env": {
      getAppUrl: () => "https://app.avenro.test",
      getWidgetAppUrl: () => WIDGET_APP_URL,
    },
    ...extraModules,
  };

  runInNewContext(
    compiled,
    {
      exports: exportsObject,
      require: (name: string) => {
        if (name in modules) return modules[name];
        throw new Error(`unstubbed module: ${name}`);
      },
      crypto,
      TextEncoder,
      atob,
      btoa,
      Uint8Array,
      Array,
      Set,
      URL,
      Headers,
      Promise,
      Date,
      JSON,
      Error,
      String,
      Number,
      Boolean,
      Object,
      console,
      process,
    },
    { filename: path },
  );

  return exportsObject;
}

const httpModule = loadModule("src/lib/widgets/http.ts");
const tokens = loadModule("src/lib/widgets/tokens.ts", {
  "@/lib/widgets/http": httpModule,
  "./server-types": {
    WIDGET_PREVIEW_TTL_MS: 15 * 60 * 1000,
    WIDGET_ACCESS_TTL_MS: 15 * 60 * 1000,
  },
}) as {
  signWidgetAccessToken: (payload: unknown) => Promise<string>;
  verifyWidgetAccessToken: (
    token: string | null,
    expectedKey: string,
  ) => Promise<unknown>;
  signWidgetPreviewToken: (payload: unknown) => Promise<string>;
  buildWidgetAccessPayload: (input: Record<string, unknown>) => unknown;
};

const corsOrigin = loadModule("src/lib/widgets/cors-origin.ts", {
  "@/lib/widgets/http": httpModule,
  "./tokens": tokens,
  "@/lib/env": {
    getAppUrl: () => "https://app.avenro.test",
    getWidgetAppUrl: () => WIDGET_APP_URL,
  },
}) as {
  resolveWidgetBootstrapAccess: (
    widget: unknown,
    request: { headers: Headers },
  ) => { ok: boolean; status?: number; code?: string; source?: string };
  resolveWidgetRuntimeAccess: (args: {
    request: { headers: Headers };
    widget: unknown;
    preview: { isPreview: boolean; previewPayload: unknown };
  }) => Promise<{ ok: boolean; status?: number; code?: string; source?: string }>;
};

const WIDGET_A = {
  id: "11111111-1111-4111-8111-111111111111",
  widget_public_key: "wgt_aaaaaaaaaaaaaaaaaa",
  allowed_origins: ["https://customer-a.test"],
  hosted_enabled: true,
  status: "deployed",
};

const WIDGET_B = {
  id: "22222222-2222-4222-8222-222222222222",
  widget_public_key: "wgt_bbbbbbbbbbbbbbbbbb",
  allowed_origins: ["https://customer-b.test"],
  hosted_enabled: true,
  status: "deployed",
};

function requestWith(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

async function accessTokenFor(
  widget: typeof WIDGET_A,
  allowedOrigin: string | null,
  source: "embedded" | "hosted" = "embedded",
) {
  return tokens.signWidgetAccessToken(
    tokens.buildWidgetAccessPayload({
      widgetPublicKey: widget.widget_public_key,
      widgetId: widget.id,
      source,
      allowedOrigin,
    }),
  );
}

// --- 1. cross-widget token reuse -------------------------------------------

test("a widget access token is rejected by a different widget", async () => {
  const token = await accessTokenFor(WIDGET_A, "https://customer-a.test");

  assert.notEqual(
    await tokens.verifyWidgetAccessToken(token, WIDGET_A.widget_public_key),
    null,
    "sanity: the token must be valid for its own widget",
  );
  assert.equal(
    await tokens.verifyWidgetAccessToken(token, WIDGET_B.widget_public_key),
    null,
    "widget A's token must not authenticate widget B",
  );
});

test("runtime access rejects a token minted for another widget", async () => {
  const token = await accessTokenFor(WIDGET_A, "https://customer-a.test");

  const result = await corsOrigin.resolveWidgetRuntimeAccess({
    request: requestWith({ "x-ag-widget-access-token": token }),
    widget: WIDGET_B,
    preview: { isPreview: false, previewPayload: null },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIDGET_ACCESS_TOKEN_INVALID");
});

// --- 2. cross-origin token reuse -------------------------------------------

test("a token bound to one origin cannot be used from another customer's domain", async () => {
  // Token legitimately issued for customer-a, replayed against a widget that
  // only allows customer-b.
  const token = await accessTokenFor(WIDGET_A, "https://customer-a.test");
  const foreignWidget = { ...WIDGET_A, allowed_origins: ["https://customer-b.test"] };

  const result = await corsOrigin.resolveWidgetRuntimeAccess({
    request: requestWith({ "x-ag-widget-access-token": token }),
    widget: foreignWidget,
    preview: { isPreview: false, previewPayload: null },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "WIDGET_DOMAIN_NOT_ALLOWED");
});

test("bootstrap refuses an origin that is not on the widget allowlist", () => {
  const denied = corsOrigin.resolveWidgetBootstrapAccess(
    WIDGET_A,
    requestWith({ origin: "https://attacker.test" }),
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "WIDGET_DOMAIN_NOT_ALLOWED");

  const allowed = corsOrigin.resolveWidgetBootstrapAccess(
    WIDGET_A,
    requestWith({ origin: "https://customer-a.test" }),
  );
  assert.equal(allowed.ok, true);
  assert.equal(allowed.source, "embedded");
});

test("bootstrap refuses a request with no origin at all", () => {
  const result = corsOrigin.resolveWidgetBootstrapAccess(WIDGET_A, requestWith({}));
  assert.equal(result.ok, false);
  assert.equal(result.code, "WIDGET_ORIGIN_REQUIRED");
});

test("hosted access is refused when hosted embedding is disabled", async () => {
  const token = await accessTokenFor(WIDGET_A, null, "hosted");

  const result = await corsOrigin.resolveWidgetRuntimeAccess({
    request: requestWith({ "x-ag-widget-access-token": token }),
    widget: { ...WIDGET_A, hosted_enabled: false },
    preview: { isPreview: false, previewPayload: null },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "HOSTED_WIDGET_DISABLED");
});

// --- 3. token integrity ----------------------------------------------------

test("an expired access token is rejected", async () => {
  const expired = await tokens.signWidgetAccessToken(
    tokens.buildWidgetAccessPayload({
      widgetPublicKey: WIDGET_A.widget_public_key,
      widgetId: WIDGET_A.id,
      source: "embedded",
      allowedOrigin: "https://customer-a.test",
      expiresInMs: -1_000,
    }),
  );

  assert.equal(
    await tokens.verifyWidgetAccessToken(expired, WIDGET_A.widget_public_key),
    null,
  );
});

test("a token whose payload is edited fails its signature check", async () => {
  const token = await accessTokenFor(WIDGET_A, "https://customer-a.test");
  const [body, mac] = token.split(".");
  const payload = JSON.parse(atob(body));

  // Escalate the payload while keeping the original MAC.
  payload.allowedOrigin = "https://attacker.test";
  const forged = `${btoa(JSON.stringify(payload))}.${mac}`;

  assert.equal(
    await tokens.verifyWidgetAccessToken(forged, WIDGET_A.widget_public_key),
    null,
    "a re-signed payload must not verify against the original MAC",
  );
});

test("a preview token cannot be presented as a runtime access token", async () => {
  // Different secret, same wire format — the access verifier must not accept it.
  const previewToken = await tokens.signWidgetPreviewToken({
    widgetPublicKey: WIDGET_A.widget_public_key,
    widgetId: WIDGET_A.id,
    workspaceId: "ws",
    userId: "user",
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });

  assert.equal(
    await tokens.verifyWidgetAccessToken(previewToken, WIDGET_A.widget_public_key),
    null,
  );
});

// --- 4. visitor identity isolation -----------------------------------------

test("the same visitor token hashes differently per widget", () => {
  const raw = "a".repeat(64);
  assert.notEqual(
    hashWidgetVisitorToken(WIDGET_A.id, raw),
    hashWidgetVisitorToken(WIDGET_B.id, raw),
    "a visitor token lifted from one widget must not address sessions on another",
  );
});

test("a session bound to one visitor rejects a different visitor", () => {
  const owner = hashWidgetVisitorToken(WIDGET_A.id, "a".repeat(64));
  const other = hashWidgetVisitorToken(WIDGET_A.id, "b".repeat(64));

  assert.equal(canAccessWidgetSession(owner, owner), true);
  assert.equal(canAccessWidgetSession(owner, other), false);
  assert.equal(canAccessWidgetSession(owner, null), false);
  // Legacy sessions with no binding stay reachable.
  assert.equal(canAccessWidgetSession(null, other), true);
});

test("malformed visitor tokens are refused before they reach a hash", () => {
  assert.equal(normalizeWidgetVisitorToken("short"), null);
  assert.equal(normalizeWidgetVisitorToken("!".repeat(64)), null);
  assert.equal(normalizeWidgetVisitorToken("x".repeat(200)), null);
  assert.equal(normalizeWidgetVisitorToken("a".repeat(64)), "a".repeat(64));
});

// --- 5. agent binding ------------------------------------------------------

test("a session cannot be switched to a different agent mid-conversation", () => {
  const widgetAgents = [
    { widgetAgentId: "wa-1", persistedWidgetAgentId: "wa-1", publishedVersionId: "v1", agent: { id: "agent-1" } },
    { widgetAgentId: "wa-2", persistedWidgetAgentId: "wa-2", publishedVersionId: "v2", agent: { id: "agent-2" } },
  ] as never;

  const switched = resolveSelectedWidgetAgent({
    widgetAgents,
    activeWidgetAgentId: "wa-1",
    activeAgentId: "agent-1",
    requestedWidgetAgentId: "wa-2",
  });

  assert.equal("error" in switched, true);
  assert.equal(
    (switched as { code: string }).code,
    "AGENT_SWITCH_REQUIRES_NEW_SESSION",
  );
});

test("an agent that is not attached to the widget is refused", () => {
  const result = resolveSelectedWidgetAgent({
    widgetAgents: [
      { widgetAgentId: "wa-1", persistedWidgetAgentId: "wa-1", publishedVersionId: "v1", agent: { id: "agent-1" } },
    ] as never,
    activeWidgetAgentId: null,
    activeAgentId: null,
    requestedWidgetAgentId: "wa-does-not-exist",
  });

  assert.equal((result as { code: string }).code, "INVALID_WIDGET_AGENT");
});

// --- 6. attachment ownership ----------------------------------------------

test("attachments belonging to another session are reported as missing, never signed", async () => {
  const queried: Record<string, unknown> = {};
  const supabase = {
    from() {
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          queried[column] = value;
          return builder;
        },
        // Simulates the DB honouring the widget+session scope: no rows come back.
        in: async (column: string, values: string[]) => {
          queried[column] = values;
          return { data: [], error: null };
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          createSignedUrls: async () => {
            throw new Error("must not sign an attachment that failed the ownership scope");
          },
        };
      },
    },
  } as never;

  const result = await resolveWidgetAttachmentUrls(supabase, {
    widgetId: WIDGET_A.id,
    widgetSessionId: "session-1",
    attachmentIds: ["att-owned-by-someone-else"],
  });

  assert.deepEqual(result.missingIds, ["att-owned-by-someone-else"]);
  assert.equal(result.byId.size, 0);
  // The ownership scope must actually be applied in the query, not assumed.
  assert.equal(queried.widget_id, WIDGET_A.id);
  assert.equal(queried.widget_session_id, "session-1");
});

// --- 7. quota / rate limiting ---------------------------------------------

test("rate limiting denies on the first exhausted rule and reports its retry hint", async () => {
  const rules = [
    { endpoint: "e", scopeKind: "ip_global", scopeKey: "ip", windowSeconds: 600, limit: 120, code: "RATE_LIMITED_CHAT", message: "global" },
    { endpoint: "e", scopeKind: "widget_session", scopeKey: "sess", windowSeconds: 60, limit: 12, code: "RATE_LIMITED_CHAT", message: "session" },
  ];

  const decision = await enforceRateLimits(
    {
      rpc: async (_fn: string, args: Record<string, unknown>) => ({
        data: [
          args.p_scope_kind === "widget_session"
            ? { allowed: false, retry_after_seconds: 42 }
            : { allowed: true },
        ],
        error: null,
      }),
    } as never,
    rules as never,
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.scopeKind, "widget_session");
  assert.equal(decision.retryAfterSeconds, 42);
});

test("rate limiting allows only when every scope allows", async () => {
  const decision = await enforceRateLimits(
    { rpc: async () => ({ data: [{ allowed: true }], error: null }) } as never,
    [
      { endpoint: "e", scopeKind: "a", scopeKey: "1", windowSeconds: 60, limit: 5, code: "C", message: "m" },
      { endpoint: "e", scopeKind: "b", scopeKey: "2", windowSeconds: 60, limit: 5, code: "C", message: "m" },
    ] as never,
  );

  assert.equal(decision.allowed, true);
});

test("a rate-limit backend failure fails closed by throwing, not by allowing", async () => {
  await assert.rejects(
    enforceRateLimits(
      { rpc: async () => ({ data: null, error: { message: "db down" } }) } as never,
      [{ endpoint: "e", scopeKind: "a", scopeKey: "1", windowSeconds: 60, limit: 5, code: "C", message: "m" }] as never,
    ),
    /db down/,
  );
});
