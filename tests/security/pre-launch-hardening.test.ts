import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const usageResetMigration = readFileSync(
  "supabase/migrations/20260918120000_reset_usage_on_billing_period_advance.sql",
  "utf8",
);
const widgetChatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const memberRoute = readFileSync(
  "src/app/api/workspaces/[id]/members/[memberId]/route.ts",
  "utf8",
);
const agentChat = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");

test("a renewal that advances the period also clears the old allowance", () => {
  // Without this, `billing_cycle_end` moved into the future before the next
  // message arrived, so the expiry-based reset in
  // `increment_workspace_message_usage` never fired again and a paying
  // customer kept last month's exhausted quota.
  assert.match(usageResetMigration, /messages_used = case/);
  assert.match(usageResetMigration, /p_period_start > billing_cycle_start/);
});

test("a replayed or same-period event does not reset usage again", () => {
  // Only a strictly later period start resets, so redeliveries and
  // same-period plan changes leave `messages_used` alone.
  assert.doesNotMatch(usageResetMigration, /messages_used = 0,\s*\n\s*billing_cycle/);
  assert.match(usageResetMigration, /then 0\s*\n\s*else messages_used/);
});

test("the public widget path does not persist a raw debug trace", () => {
  // The runtime already decides what is safe to keep. Re-adding
  // `result.debugTrace` here put raw tool arguments back into storage on the
  // one route anonymous visitors can reach.
  assert.doesNotMatch(
    widgetChatRoute,
    /debugTrace: result\.debugTrace/,
  );
  assert.match(widgetChatRoute, /buildPersistedAssistantMetadata\(/);
});

test("removing a member drops their cached workspace access immediately", () => {
  assert.match(memberRoute, /invalidateWorkspaceContextCache\(/);
  assert.match(
    memberRoute,
    /invalidateWorkspaceContextCache\(\s*targetMember\.user_id/,
  );
});

test("a timed-out tool call is not reported to the visitor as a clean failure", () => {
  // The provider SDK takes no abort signal, so a timed-out write may still
  // land. Telling the model to offer a retry is how one booking becomes two.
  const timeoutMessage = agentChat.match(
    /Tool call timed out before confirming a result\.[^"]*/,
  );

  assert.ok(timeoutMessage, "expected the timeout tool message to be present");
  assert.match(timeoutMessage[0], /do not repeat it/i);
  assert.doesNotMatch(timeoutMessage[0], /offer to try again/i);
});

test("tool results are rebuilt from the requested calls, not the returned ones", () => {
  // The wrapper can expand one requested call into several (`<id>_primary`).
  // Emitting a result id the assistant message never contained makes the next
  // model call invalid, so companions fold back into their parent.
  assert.match(agentChat, /externalToolMessages = externalToolCalls\.map\(/);
  assert.match(agentChat, /id\.startsWith\(`\$\{toolCall\.id\}_`\)/);
});
