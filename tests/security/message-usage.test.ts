import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  consumeWorkspaceMessageUsage,
  MessageLimitExceededError,
} from "../../src/lib/message-usage.ts";

test("message usage helper rejects exhausted workspaces", async () => {
  await assert.rejects(
    consumeWorkspaceMessageUsage(
      {
        async rpc(fn, args) {
          assert.equal(fn, "increment_workspace_message_usage");
          assert.deepEqual(args, { p_workspace_id: "workspace-1" });
          return { data: false, error: null };
        },
      },
      "workspace-1",
    ),
    MessageLimitExceededError,
  );
});

test("OpenRouter entry points consume workspace message quota before model calls", () => {
  const files = [
    "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
    "src/app/api/assistants/[id]/chat/route.ts",
    "src/app/api/agents/[id]/chat/route.ts",
    "src/app/api/agents/[id]/optimize-prompt/route.ts",
    "src/lib/automation/executor.ts",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const quotaIndex = source.indexOf("await consumeWorkspaceMessageUsage");
    const modelMatches = [...source.matchAll(/(?:await\s+)?(?:runAgentChat|createOpenRouterChatCompletion)\(/g)];
    const modelIndex = modelMatches.at(-1)?.index ?? -1;

    assert.notEqual(quotaIndex, -1, `${file} must consume quota`);
    assert.notEqual(modelIndex, -1, `${file} must call an OpenRouter-backed path`);
    assert.ok(
      quotaIndex < modelIndex,
      `${file} must consume quota before calling the model`,
    );
  }
});

test("widget builder preview chat is billed even though preview skips public rate limits", () => {
  const source = readFileSync(
    "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
    "utf8",
  );
  const previewRateLimitGuardIndex = source.indexOf(
    'if (access.source !== "preview")',
  );
  const rateLimitIndex = source.indexOf("await enforceRateLimits", previewRateLimitGuardIndex);
  const quotaIndex = source.indexOf("await consumeWorkspaceMessageUsage", rateLimitIndex);
  const modelIndex = source.indexOf("await runAgentChat", quotaIndex);

  assert.notEqual(
    previewRateLimitGuardIndex,
    -1,
    "public widget chat must keep preview-token traffic out of public rate limiting",
  );
  assert.notEqual(rateLimitIndex, -1, "public widget chat must enforce public rate limits");
  assert.notEqual(
    quotaIndex,
    -1,
    "public widget chat must consume quota after access/rate-limit handling",
  );
  assert.notEqual(modelIndex, -1, "public widget chat must call the model after quota");
  assert.ok(
    previewRateLimitGuardIndex < rateLimitIndex && rateLimitIndex < quotaIndex,
    "quota consumption must be outside the non-preview-only rate-limit branch",
  );
  assert.ok(
    quotaIndex < modelIndex,
    "widget preview chat must consume credits before invoking OpenRouter",
  );
});
