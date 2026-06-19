import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const automationRouteSource = readFileSync(
  "src/app/api/agents/[id]/automation/route.ts",
  "utf8",
);
const activityPageSource = readFileSync(
  "src/app/(app)/agents/[id]/activity/page.tsx",
  "utf8",
);
const integrationsSource = readFileSync("src/lib/integrations.ts", "utf8");
const runtimeSource = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");
const composioSource = readFileSync("src/lib/composio.ts", "utf8");

test("automation activity API returns recent run steps and the expected webhook URL", () => {
  assert.match(automationRouteSource, /from\("run_steps"\)/);
  assert.match(automationRouteSource, /steps: runStepsResult\.data \?\? \[\]/);
  assert.match(automationRouteSource, /expectedWebhookUrl:/);
  assert.match(automationRouteSource, /getAppUrl\(\)/);
  assert.match(automationRouteSource, /appUrlMatchesRequestOrigin/);
});

test("automation activity displays tool outcomes, run steps, and readiness failures", () => {
  assert.match(activityPageSource, /Tool actions/);
  assert.match(activityPageSource, /Run steps/);
  assert.match(activityPageSource, /Webhook readiness problem/);
  assert.match(activityPageSource, /expectedWebhookUrl/);
  assert.match(activityPageSource, /App URL mismatch/);
  assert.match(activityPageSource, /linkedRun\?\.error_message/);
});

test("new Gmail nodes include reply-to-thread and fixed recipients cannot use it", () => {
  assert.match(
    integrationsSource,
    /recommendedChatTools: \["GMAIL_SEND_EMAIL", "GMAIL_REPLY_TO_THREAD"\]/,
  );
  assert.match(runtimeSource, /applyEmailToolRestrictions/);
  assert.match(runtimeSource, /toolName !== GMAIL_REPLY_TO_THREAD_TOOL/);
  assert.match(runtimeSource, /prefer GMAIL_REPLY_TO_THREAD/);
  assert.match(composioSource, /GMAIL_REPLY_TO_THREAD_TOOL/);
});
