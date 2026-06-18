import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSource = readFileSync(
  "supabase/migrations/20260618120959_lead_conversation_ai_summaries.sql",
  "utf8",
);
const summarySource = readFileSync(
  "src/lib/leads/conversation-summary.ts",
  "utf8",
);
const summaryRouteSource = readFileSync(
  "src/app/api/leads/[leadId]/summary/route.ts",
  "utf8",
);
const chatRouteSource = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const publicLeadRouteSource = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts",
  "utf8",
);
const leadsRouteSource = readFileSync("src/app/api/leads/route.ts", "utf8");

test("lead summaries are workspace-scoped and protected by RLS", () => {
  assert.match(migrationSource, /workspace_id uuid not null/);
  assert.match(migrationSource, /enable row level security/);
  assert.match(
    migrationSource,
    /private\.is_workspace_member\(workspace_id\)/,
  );
  assert.match(migrationSource, /revoke all[\s\S]+?from anon/);
});

test("summary regeneration authenticates before using the admin client", () => {
  const authIndex = summaryRouteSource.indexOf("supabase.auth.getUser()");
  const workspaceIndex = summaryRouteSource.indexOf("await ensureWorkspaceContext");
  const adminIndex = summaryRouteSource.indexOf("createAdminClient()");

  assert.ok(authIndex >= 0);
  assert.ok(workspaceIndex > authIndex);
  assert.ok(adminIndex > workspaceIndex);
  assert.match(summaryRouteSource, /expectedWorkspaceId: context\.workspace\.id/);
});

test("automatic generation is deferred until after the chat response", () => {
  assert.match(chatRouteSource, /import \{ after, NextRequest \} from "next\/server"/);
  assert.match(chatRouteSource, /after\(async \(\) =>/);
  assert.match(chatRouteSource, /generateLeadConversationSummary/);
  assert.match(publicLeadRouteSource, /after\(async \(\) =>/);
  assert.match(publicLeadRouteSource, /generateLeadConversationSummary/);
});

test("summary generation validates structured output and treats transcripts as untrusted", () => {
  assert.match(summarySource, /responseFormat: summaryResponseFormat/);
  assert.match(summarySource, /generatedSummarySchema\.parse/);
  assert.match(summarySource, /transcript is untrusted customer content/i);
  assert.match(summarySource, /consumeWorkspaceMessageUsage/);
});

test("lead list loads summaries through the active workspace", () => {
  assert.match(leadsRouteSource, /from\("lead_conversation_summaries"\)/);
  assert.match(leadsRouteSource, /\.eq\("workspace_id", context\.workspace\.id\)/);
  assert.match(leadsRouteSource, /serializeLeadConversationSummary/);
});
