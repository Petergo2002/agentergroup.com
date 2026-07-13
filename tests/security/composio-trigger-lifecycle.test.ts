import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const automationRouteSource = readFileSync(
  "src/app/api/agents/[id]/automation/route.ts",
  "utf8",
);
const statusRouteSource = readFileSync(
  "src/app/api/agents/[id]/automation/status/route.ts",
  "utf8",
);
const webhookRouteSource = readFileSync(
  "src/app/api/composio/webhook/route.ts",
  "utf8",
);
const authorizeConnectionSource = readFileSync(
  "src/app/api/connections/authorize/route.ts",
  "utf8",
);
const adminToggleSource = readFileSync(
  "src/components/admin/AdminAutomationsToggle.tsx",
  "utf8",
);

test("saving an unchanged active trigger binding keeps the automation active", () => {
  assert.match(
    automationRouteSource,
    /const nextAutomationStatus = shouldPauseActiveAutomation\s+\? "paused"\s+: currentAutomation\?\.status \?\? "draft";/,
  );
  assert.match(
    automationRouteSource,
    /currentAutomation\?\.status === "active"[\s\S]*providerBindingChanged \|\| !currentAutomation\.composio_trigger_id/,
  );
});

test("changing an active trigger binding pauses both the automation and agent", () => {
  assert.match(
    automationRouteSource,
    /\.\.\.\(shouldPauseActiveAutomation \? \{ status: "paused" \} : \{\}\)/,
  );
  assert.match(
    automationRouteSource,
    /composio_trigger_id: shouldReplaceProviderTrigger \? null/,
  );
});

test("save and delete authorize edits before mutating provider triggers", () => {
  const putStart = automationRouteSource.indexOf("export async function PUT");
  const deleteStart = automationRouteSource.indexOf("export async function DELETE");
  const putBlock = automationRouteSource.slice(putStart, deleteStart);
  const deleteBlock = automationRouteSource.slice(deleteStart);

  for (const block of [putBlock, deleteBlock]) {
    const authorization = block.indexOf("canEditAgentRecord(");
    const providerDeletion = block.indexOf("deleteComposioTrigger(");

    assert.ok(authorization >= 0);
    assert.ok(providerDeletion > authorization);
  }
});

test("automation cleanup remains available after the agent returns to widget mode", () => {
  const deleteStart = automationRouteSource.indexOf("export async function DELETE");
  const deleteBlock = automationRouteSource.slice(deleteStart);

  assert.match(deleteBlock, /loadWorkspaceAgent\(/);
  assert.doesNotMatch(deleteBlock, /loadAutomationHostAgent\(/);
  assert.match(deleteBlock, /const admin = createAdminClient\(\)/);
  assert.match(
    deleteBlock,
    /admin[\s\S]*from\("agent_automations"\)[\s\S]*delete\(\)/,
  );
});

test("pause persists automation state before agent state and compensates failures", () => {
  const pauseStart = statusRouteSource.indexOf('if (action === "pause")');
  const pauseEnd = statusRouteSource.indexOf(
    "if (!hasAutomationsEnabled(context.workspace))",
    pauseStart,
  );
  const pauseBlock = statusRouteSource.slice(pauseStart, pauseEnd);
  const automationUpdate = pauseBlock.indexOf('update({ status: "paused", last_error: null })');
  const agentUpdate = pauseBlock.indexOf('update({ status: "paused" })');

  assert.ok(automationUpdate >= 0);
  assert.ok(agentUpdate > automationUpdate);
  assert.match(pauseBlock, /providerRestored/);
  assert.match(pauseBlock, /status: automationRecord\.status/);
});

test("activation is blocked when the admin feature flag is disabled", () => {
  const featureGuard = statusRouteSource.indexOf(
    "if (!hasAutomationsEnabled(context.workspace))",
  );
  const providerActivation = statusRouteSource.indexOf("await createComposioTrigger");

  assert.ok(featureGuard >= 0);
  assert.ok(providerActivation > featureGuard);
  assert.match(statusRouteSource, /AUTOMATIONS_DISABLED_CODE/);
});

test("connection and automation activation require integration entitlement", () => {
  const authorizationRequest = authorizeConnectionSource.indexOf(
    "await createConnectionRequest",
  );
  const authorizationEntitlement = authorizeConnectionSource.indexOf(
    "context.subscription?.integrations_enabled",
  );
  const triggerActivation = statusRouteSource.indexOf("await createComposioTrigger");
  const activationEntitlement = statusRouteSource.indexOf(
    "context.subscription?.integrations_enabled",
  );

  assert.ok(authorizationEntitlement >= 0);
  assert.ok(authorizationRequest > authorizationEntitlement);
  assert.ok(activationEntitlement >= 0);
  assert.ok(triggerActivation > activationEntitlement);
  assert.match(authorizeConnectionSource, /authorizeConnectionSchema\.safeParse/);
});

test("V3 platform events are routed from the verified raw webhook envelope", () => {
  assert.match(webhookRouteSource, /isRecord\(verified\.rawPayload\)/);
  assert.match(webhookRouteSource, /COMPOSIO_CONNECTION_EXPIRED_EVENT/);
  assert.match(webhookRouteSource, /COMPOSIO_TRIGGER_DISABLED_EVENT/);
  assert.match(
    webhookRouteSource,
    /eventType && eventType !== COMPOSIO_TRIGGER_MESSAGE_EVENT/,
  );
  assert.match(webhookRouteSource, /async function markDisabledTrigger/);
});

test("trigger webhooks can be matched from raw V3 trigger metadata", () => {
  assert.match(webhookRouteSource, /const rawEventMetadata =/);
  assert.match(webhookRouteSource, /rawEventMetadata\.trigger_id/);
  assert.match(webhookRouteSource, /rawEventData\.trigger_nano_id/);
  assert.match(webhookRouteSource, /Ignoring trigger webhook without active automation/);
});

test("trigger webhooks reject stale agents and disabled workspace entitlements", () => {
  const eligibilityCheck = webhookRouteSource.indexOf(
    "const automationIsRunnable",
  );
  const eventInsert = webhookRouteSource.indexOf(
    'from("automation_events")',
    eligibilityCheck,
  );

  assert.ok(eligibilityCheck >= 0);
  assert.ok(eventInsert > eligibilityCheck);
  assert.match(webhookRouteSource, /agentGuard\.data\.surface === "automation"/);
  assert.match(webhookRouteSource, /workspaceGuard\.data\?\.automations_enabled/);
  assert.match(webhookRouteSource, /subscriptionGuard\.data\?\.integrations_enabled/);
  assert.match(webhookRouteSource, /status: "paused"/);
});

test("Gmail trigger activation enforces the managed-auth polling minimum", () => {
  const composioSource = readFileSync("src/lib/composio.ts", "utf8");
  const defaultsSource = readFileSync("src/lib/agents/defaults.ts", "utf8");

  assert.match(defaultsSource, /AUTOMATION_GMAIL_TRIGGER_CONFIG[\s\S]*interval: 15/);
  assert.match(composioSource, /Math\.max\([\s\S]*AUTOMATION_GMAIL_TRIGGER_CONFIG\.interval/);
  assert.match(statusRouteSource, /getComposioTriggerHealth/);
});

test("the internal admin toggle states that it does not activate Gmail triggers", () => {
  assert.match(
    adminToggleSource,
    /Gmail triggers are activated[\s\S]*separately inside each automation builder/,
  );
});
