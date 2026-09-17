import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as messageUsage from "../../src/lib/message-usage.ts";
import { resolveSelectedWidgetAgent } from "../../src/lib/widgets/selection.ts";

// Execute the actual route, replacing external services rather than asserting
// source-text ordering. No database, provider, or real message credits are used.
const routePath = "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts";
const compiledRoute = ts.transpileModule(readFileSync(routePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const browserSessionId = "d3407571-dc76-4d82-8863-998034e53cd4";
const databaseSessionId = "f362b335-077f-4ba2-80c1-f12bcc2708c4";

type ChatRoute = {
  POST(request: Request, context: {
    params: Promise<{ widgetPublicKey: string }>;
  }): Promise<Response>;
};

function createHarness(options: {
  source?: "hosted" | "preview";
  blockedStatus?: "active" | "completed";
  quota?: "available" | "exhausted" | "error";
  persistenceFails?: boolean;
  modelGate?: Promise<void>;
} = {}) {
  const state = {
    charges: 0, quotaCalls: 0, modelCalls: 0, releases: 0,
    lockOwner: null as string | null,
    runtimeSessionId: null as string | null,
  };
  const source = options.source ?? "hosted";
  const modelStarted = Promise.withResolvers<void>();
  const session = { id: databaseSessionId, session_id: browserSessionId, source };
  const agent = { id: "agent", workspace_id: "workspace" };
  const selection = { agent, widgetAgentId: "widget-agent", publishedVersionId: "version" };
  const db = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "increment_workspace_message_usage");
      assert.deepEqual(args, { p_workspace_id: "workspace" });
      state.quotaCalls++;
      if (options.quota === "error") return { data: null, error: { message: "Quota unavailable" } };
      if (options.quota === "exhausted") return { data: false, error: null };
      state.charges++;
      return { data: true, error: null };
    },
  };
  const modules: Record<string, unknown> = {
    // These tests cover the response lifecycle, not background follow-up jobs.
    "next/server": { after() {} },
    "@/lib/message-usage": messageUsage,
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/connections": { buildWorkspaceComposioUserId: () => "workspace-user" },
    "@/lib/validation/widget-schemas": {
      validateBody: async (request: Request) => ({ valid: true, value: await request.json() }),
    },
    "@/lib/rate-limit": {
      buildPublicWidgetRateLimitContext: () => ({}),
      getPublicWidgetRateLimitRules: () => [],
      enforceRateLimits: async () => ({ allowed: true }),
    },
    "@/lib/widgets/visitor": {
      readWidgetVisitorToken: () => null,
      hashWidgetVisitorToken: () => null,
      buildConversationTitle: (value: string) => value,
      buildConversationPreview: (value: string) => value,
    },
    "@/lib/widgets": {
      readAgentIdFromDraftPreviewWidgetAgentId: () => null,
    },
    "@/lib/widgets/generative-ui": { buildWidgetGenerativeUi: () => null },
    "@/lib/widgets/server": {
      resolveSelectedWidgetAgent,
      resolveWidgetRuntimeRequestOrigin: () => ({ ok: true }),
      buildWidgetRuntimeCorsHeaders: () => ({}),
      loadWidgetByPublicKey: async () => ({
        widget: { id: "widget", workspace_id: "workspace", status: "deployed" },
        // Mirrors loadWidgetAgentsWithAgents' { widgetAgent, agent } shape.
        widgetAgents: [{ widgetAgent: { id: "widget-agent" }, agent }],
      }),
      resolveWidgetPreviewContext: async () => ({ isPreview: source === "preview" }),
      resolveWidgetRuntimeAccess: async () => ({ ok: true, source }),
      loadWidgetSession: async () => null,
      buildStoredWidgetRuntimeAgents: () => [selection],
      upsertWidgetSession: async () => session,
      acquireWidgetSessionTurnLock: async (_db: unknown, input: { requestId: string }) => {
        if (options.blockedStatus || state.lockOwner) {
          return { acquired: false, sessionStatus: options.blockedStatus ?? "active" };
        }
        state.lockOwner = input.requestId;
        return { acquired: true, sessionStatus: "active" };
      },
      releaseWidgetSessionTurnLock: async (_db: unknown, input: { requestId: string }) => {
        assert.equal(state.lockOwner, input.requestId);
        state.lockOwner = null;
        state.releases++;
        return true;
      },
      insertWidgetMessages: async (_db: unknown, input: { messages: Array<{ role: string }> }) => {
        if (options.persistenceFails) throw new Error("Message persistence failed");
        return input.messages.map(({ role }) => ({ id: `${role}-message`, role }));
      },
      loadOrderedWidgetSessionHistory: async () => [],
      getPublishedAgentVersion: async () => ({ definition: {} }),
      autoCaptureLead: async () => null,
      getWidgetRuntimeAgent: () => agent,
    },
    "@/lib/end-chat": { extractEndChatPolicyFromDefinition: () => null },
    "@/lib/gmail": { extractGmailRecipientPolicyFromDefinition: () => null },
    "@/lib/google-calendar": { extractGoogleCalendarSelectionFromDefinition: () => ({ timezone: "UTC" }) },
    "@/lib/cal": { extractCalSelectionFromDefinition: () => null },
    "@/lib/tool-actions": { extractEnabledToolsFromDefinition: () => ({}) },
    "@/lib/debug-trace-security": {
      buildPersistedToolMessages: () => [],
      buildPersistedAssistantMetadata: () => ({}),
    },
    "@/lib/runtime/agent-chat": {
      async runAgentChat(input: { widgetSessionId: string; onToken: (token: string) => void }) {
        state.modelCalls++;
        state.runtimeSessionId = input.widgetSessionId;
        modelStarted.resolve();
        await options.modelGate;
        input.onToken("Hello");
        return { assistantContent: "Hello", assistantMetadata: {}, toolMessages: [], knowledgeMatches: [] };
      },
    },
    "@/lib/server-errors": { createClientSafeError: () => ({ error: "Request failed", code: "INTERNAL_ERROR" }) },
  };
  const exports = {} as ChatRoute;
  runInNewContext(compiledRoute, {
    exports,
    require: (name: string) => modules[name] ?? {},
    crypto, Response, ReadableStream, TextEncoder, AbortController, DOMException, Error,
    // The route arms a turn deadline, so the sandbox has to provide timers.
    setTimeout, clearTimeout,
    console: { info() {}, error() {} },
  }, { filename: routePath });

  return {
    state,
    modelStarted: modelStarted.promise,
    post: () => exports.POST(new Request("https://widget.test/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId: browserSessionId, message: "Hello" }),
    }), { params: Promise.resolve({ widgetPublicKey: "public-key" }) }),
  };
}

for (const [status, code] of [["active", "SESSION_BUSY"], ["completed", "SESSION_COMPLETED"]] as const) {
  test(`a turn rejected as ${code} does not consume quota`, async () => {
    const harness = createHarness({ blockedStatus: status });
    const response = await harness.post();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, code);
    assert.equal(harness.state.quotaCalls, 0);
    assert.equal(harness.state.modelCalls, 0);
    assert.equal(harness.state.releases, 0);
  });
}

for (const source of ["hosted", "preview"] as const) {
  test(`${source} chat scopes uploaded knowledge to the database session ID`, async () => {
    const harness = createHarness({ source });
    const response = await harness.post();
    const stream = await response.text();

    assert.equal(response.status, 200);
    assert.match(stream, /"delta":"Hello"/);
    assert.match(stream, /\[DONE\]/);
    assert.doesNotMatch(stream, /"error":/);
    // Uploads store knowledge_sources.widget_session_id using widget_sessions.id,
    // which is a different identifier from the browser's session_id capability.
    assert.equal(harness.state.runtimeSessionId, databaseSessionId);
    assert.notEqual(harness.state.runtimeSessionId, browserSessionId);
    assert.equal(harness.state.charges, 1);
    assert.equal(harness.state.releases, 1);
  });

  test(`${source} overlapping requests charge once and preserve the accepted reply`, async () => {
    const modelGate = Promise.withResolvers<void>();
    const harness = createHarness({ source, modelGate: modelGate.promise });
    const accepted = await harness.post();
    await harness.modelStarted;
    try {
      const rejected = await harness.post();
      assert.equal(rejected.status, 409);
      assert.equal((await rejected.json()).code, "SESSION_BUSY");
      assert.equal(harness.state.charges, 1);
      assert.equal(harness.state.modelCalls, 1);
      assert.notEqual(harness.state.lockOwner, null);
    } finally {
      modelGate.resolve();
    }
    assert.equal(accepted.status, 200);
    const stream = await accepted.text();
    assert.match(stream, /"delta":"Hello"/);
    assert.match(stream, /\[DONE\]/);
    assert.equal(harness.state.lockOwner, null);
    assert.equal(harness.state.releases, 1);
  });
}

for (const [quota, status] of [["exhausted", 402], ["error", 500]] as const) {
  test(`${quota} quota releases the acquired lock and never invokes the model`, async () => {
    const harness = createHarness({ quota });
    const response = await harness.post();
    assert.equal(response.status, status);
    assert.equal(harness.state.charges, 0);
    assert.equal(harness.state.modelCalls, 0);
    assert.equal(harness.state.lockOwner, null);
    assert.equal(harness.state.releases, 1);
  });
}

test("message persistence failure still releases the accepted turn's lock", async () => {
  const harness = createHarness({ persistenceFails: true });
  assert.equal((await harness.post()).status, 500);
  assert.equal(harness.state.modelCalls, 0);
  assert.equal(harness.state.lockOwner, null);
  assert.equal(harness.state.releases, 1);
});
