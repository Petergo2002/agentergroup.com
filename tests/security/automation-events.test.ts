import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/lib/automation/executor.ts", "utf8");

test("automation event processing atomically claims only received events", () => {
  const claimStart = source.indexOf('from("automation_events")');
  const claimBody = source.slice(claimStart, source.indexOf("if (claimResult.error)", claimStart));

  assert.match(claimBody, /\.update\(\{ status: "processing" \}\)/);
  assert.match(claimBody, /\.eq\("id", eventId\)/);
  assert.match(claimBody, /\.eq\("status", "received"\)/);
  assert.match(claimBody, /\.maybeSingle\(\)/);
});

test("automation event processing records ignored, processed, and failed states", () => {
  assert.match(source, /async function markEventIgnored/);
  assert.match(source, /\.update\(\{ status: "ignored" \}\)/);
  assert.match(source, /return \{ ok: true, status: "ignored" as const \}/);

  assert.match(source, /\.update\(\{ status: "processed" \}\)/);
  assert.match(source, /return \{ ok: true, status: "processed" as const \}/);

  assert.match(source, /\.update\(\{ status: "failed" \}\)/);
  assert.match(source, /status: "failed",[\s\S]+error_message: message/);
  assert.match(source, /\.update\(\{ last_error: message \}\)/);
});

test("automation event processing catches failures that happen before run creation", () => {
  const eventStart = source.indexOf("const event = claimResult.data");
  const tryStart = source.indexOf("try {", eventStart);
  const automationLookup = source.indexOf('from("agent_automations")', eventStart);
  const runInsert = source.indexOf('from("runs")', eventStart);
  const catchStart = source.indexOf("} catch (error)", eventStart);
  const catchBlock = source.slice(catchStart);

  assert.ok(tryStart > eventStart);
  assert.ok(automationLookup > tryStart);
  assert.ok(runInsert > automationLookup);
  assert.match(catchBlock, /from\("automation_events"\)[\s\S]*status: "failed"/);
  assert.match(catchBlock, /automation\s+\? supabase[\s\S]*last_error: message/);
});

test("automation event processing checks lifecycle persistence errors", () => {
  assert.match(source, /if \(eventLinkUpdate\.error\)/);
  assert.match(source, /if \(runUpdate\.error\)/);
  assert.match(source, /if \(eventUpdate\.error\)/);
  assert.match(source, /if \(automationUpdate\.error\)/);
  assert.match(source, /Automation failure state persistence failed/);
});

test("automation event processing consumes quota before running the agent runtime", () => {
  const quotaIndex = source.indexOf("await consumeWorkspaceMessageUsage");
  const runtimeIndex = source.indexOf("await runAgentChat", quotaIndex);

  assert.notEqual(quotaIndex, -1, "automation executor must consume workspace quota");
  assert.notEqual(runtimeIndex, -1, "automation executor must call the shared agent runtime");
  assert.ok(
    quotaIndex < runtimeIndex,
    "automation executor must consume quota before invoking the model runtime",
  );
});

test("automation execution rechecks feature and billing entitlement before creating a run", () => {
  const entitlementCheck = source.indexOf(
    "subscriptionResult.data?.integrations_enabled",
  );
  const runInsert = source.indexOf('from("runs")', entitlementCheck);

  assert.ok(entitlementCheck >= 0);
  assert.ok(runInsert > entitlementCheck);
  assert.match(source, /workspaceResult\.data\?\.automations_enabled/);
  assert.match(source, /status: "paused"/);
});

test("automation runtime receives the normalized trigger event as a user message", () => {
  assert.match(source, /normalizeAutomationTriggerPayload/);
  assert.match(source, /const automationInput = buildAutomationInput/);
  assert.match(source, /history: \[\{ role: "user", content: automationInput \}\]/);
});

test("automation runs record context, decision, and action steps", () => {
  assert.match(source, /stepKey: "automation\.context"/);
  assert.match(source, /stepKey: "automation\.decision"/);
  assert.match(source, /stepKey: `automation\.action\.\$\{index \+ 1\}`/);
});

test("automation runs persist a dedicated operational result without trusting model claims", () => {
  assert.match(source, /buildAutomationRunResult/);
  assert.match(source, /automationResult,/);
  assert.match(source, /assistantContent: automationResult\.summary/);
  assert.match(source, /buildPersistedRunOutput/);
  assert.match(source, /agent\.surface !== "automation"/);
});
