import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConversationPreview,
  buildConversationTitle,
  canAccessWidgetSession,
  hashWidgetVisitorToken,
  normalizeWidgetVisitorToken,
} from "../../src/lib/widgets/visitor.ts";

const historyRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/conversations/route.ts",
  "utf8",
);
const chatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const sessionHook = readFileSync(
  "apps/widget-v2/src/hooks/useSession.ts",
  "utf8",
);
const apiClient = readFileSync("apps/widget-v2/src/lib/api.ts", "utf8");
const widgetHttp = readFileSync("src/lib/widgets/http.ts", "utf8");
const widgetRuntime = readFileSync("apps/widget-v2/src/Widget.tsx", "utf8");
const homeTab = readFileSync(
  "apps/widget-v2/src/components/HomeTab.tsx",
  "utf8",
);
const conversationList = readFileSync(
  "apps/widget-v2/src/components/ConversationList.tsx",
  "utf8",
);
const messagesTab = readFileSync(
  "apps/widget-v2/src/components/MessagesTab.tsx",
  "utf8",
);
const contactTab = readFileSync(
  "apps/widget-v2/src/components/ContactTab.tsx",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260911090730_widget_visitor_conversation_history.sql",
  "utf8",
);
const previewIndexMigration = readFileSync(
  "supabase/migrations/20260911143000_widget_preview_conversation_history_index.sql",
  "utf8",
);
const completeRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/complete/route.ts",
  "utf8",
);
const leadsRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts",
  "utf8",
);
const uploadRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/upload/route.ts",
  "utf8",
);

test("visitor capability tokens are validated and stored only as scoped hashes", () => {
  const token = "a".repeat(64);
  assert.equal(normalizeWidgetVisitorToken(token), token);
  assert.equal(normalizeWidgetVisitorToken("short"), null);
  assert.equal(normalizeWidgetVisitorToken(`${"a".repeat(40)}!`), null);

  const firstHash = hashWidgetVisitorToken("widget-one", token);
  const secondHash = hashWidgetVisitorToken("widget-two", token);
  assert.match(firstHash, /^[0-9a-f]{64}$/);
  assert.notEqual(firstHash, token);
  assert.notEqual(firstHash, secondHash);
  assert.equal(canAccessWidgetSession(firstHash, firstHash), true);
  assert.equal(canAccessWidgetSession(firstHash, secondHash), false);
  assert.equal(canAccessWidgetSession(null, secondHash), true);
});

test("conversation labels are compact and safe for list rendering", () => {
  assert.equal(buildConversationTitle("  Hello   there  "), "Hello there");
  assert.equal(buildConversationPreview("\nHello\tthere\n"), "Hello there");
  assert.equal(buildConversationTitle("x".repeat(100)).length, 72);
  assert.equal(buildConversationPreview("x".repeat(200))?.length, 120);
});

test("history storage keeps RLS and adds a bounded lookup index", () => {
  assert.match(migration, /add column if not exists visitor_token_hash text/);
  assert.match(migration, /add column if not exists conversation_title text/);
  assert.match(migration, /add column if not exists last_message_preview text/);
  assert.match(
    migration,
    /widget_sessions_visitor_history_idx[\s\S]*widget_id, visitor_token_hash, last_seen_at desc/,
  );
  assert.match(migration, /visitor_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(
    previewIndexMigration,
    /widget_sessions_preview_visitor_history_idx[\s\S]*widget_id, visitor_token_hash, last_seen_at desc[\s\S]*source = 'preview'/,
  );
});

test("history reads require both widget access and the visitor capability hash", () => {
  const accessIndex = historyRoute.indexOf("resolveWidgetRuntimeAccess");
  const visitorIndex = historyRoute.indexOf("readWidgetVisitorToken");
  const sessionQueryIndex = historyRoute.indexOf('.from("widget_sessions")');
  const messageQueryIndex = historyRoute.indexOf(
    '.from("widget_session_messages")',
  );

  assert.ok(accessIndex >= 0);
  assert.ok(visitorIndex > accessIndex);
  assert.ok(sessionQueryIndex > visitorIndex);
  assert.ok(messageQueryIndex > sessionQueryIndex);
  assert.match(historyRoute, /\.eq\("visitor_token_hash", visitorTokenHash\)/);
  assert.match(historyRoute, /\.in\("role", \["user", "assistant"\]\)/);
  assert.match(historyRoute, /"Cache-Control": "private, no-store"/);
});

test("chat writes bind sessions to the same visitor capability", () => {
  const ownershipCheck = chatRoute.indexOf("existingSession?.visitor_token_hash");
  const sessionUpsert = chatRoute.indexOf("const widgetSession = await upsertWidgetSession");
  assert.ok(ownershipCheck >= 0);
  assert.ok(sessionUpsert > ownershipCheck);
  assert.match(chatRoute, /CONVERSATION_ACCESS_DENIED/);
  assert.match(chatRoute, /visitorTokenHash:/);
});

test("the widget uses persistent cryptographic browser identity and no-store history requests", () => {
  assert.match(sessionHook, /localStorage\.setItem\(sessionKey, newSession\)/);
  assert.match(sessionHook, /crypto\.randomUUID\(\)/);
  assert.match(sessionHook, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(apiClient, /x-ag-widget-visitor-token/);
  assert.match(widgetHttp, /x-ag-widget-visitor-token/);
  assert.match(apiClient, /getWidgetConversations/);
  assert.match(apiClient, /cache: "no-store"/);
});

test("builder previews read real history, scoped away from live visitor chats", () => {
  // The preview surface must never fall back to fabricated sample conversations.
  assert.doesNotMatch(widgetRuntime, /preview-conversations/);
  assert.doesNotMatch(widgetRuntime, /buildPreviewConversationSummaries/);
  assert.doesNotMatch(conversationList, /isPreview/);

  // Preview and live sessions live in the same table, so every history read is
  // pinned to exactly one source.
  assert.match(historyRoute, /const isPreviewAccess = access\.source === "preview"/);
  assert.match(
    historyRoute,
    /isPreviewAccess\s*\?\s*query\.eq\("source", "preview"\)\s*:\s*query\.neq\("source", "preview"\)/,
  );
  // Both the summary list and the single-conversation read go through the scope.
  assert.equal(historyRoute.match(/await scopeToRuntimeSource\(/g)?.length, 2);
  assert.doesNotMatch(historyRoute, /conversations: \[\]/);

  // Previews run against drafts, so only live runtimes require a deployed widget.
  assert.match(
    historyRoute,
    /!isPreviewAccess && loaded\.widget\.status !== "deployed"/,
  );

  // Every session-writing route binds the visitor capability in both runtimes.
  for (const route of [chatRoute, completeRoute, leadsRoute, uploadRoute]) {
    assert.match(route, /const visitorToken = readWidgetVisitorToken\(request\);/);
    assert.doesNotMatch(route, /access\.source === "preview" \? null : readWidgetVisitorToken/);
  }

  // Preview keeps its own visitor identity so draft testing never surfaces in,
  // or inherits from, the live embed on the same browser.
  assert.match(sessionHook, /VISITOR_KEY_PREFIX\}_preview_\$\{widgetPublicKey\}/);
  assert.match(
    widgetRuntime,
    /const hasRuntimeAccess = previewMode\s*\?\s*Boolean\(previewTokenKey\)\s*:\s*Boolean\(accessToken\)/,
  );
});

test("opening history and switching conversations avoids avoidable waits", () => {
  // Skeletons are for a first load only; later refreshes revalidate in place.
  assert.match(
    widgetRuntime,
    /const isFirstLoad = conversationsRef\.current\.length === 0/,
  );
  assert.match(widgetRuntime, /if \(isFirstLoad\) \{\s*setIsHistoryLoading\(true\);/);
  // The guarded first load is the only place that may show them.
  assert.equal(widgetRuntime.match(/setIsHistoryLoading\(true\)/g)?.length, 1);

  // A prefetched conversation opens with no network wait, and the list stays on
  // screen with a row spinner when one still has to be fetched.
  assert.match(
    widgetRuntime,
    /const cached = conversationCacheRef\.current\.get\(conversation\.sessionId\);[\s\S]*applyConversation\(cached\);\s*return;/,
  );
  assert.match(widgetRuntime, /setOpeningSessionId\(conversation\.sessionId\)/);
  assert.match(conversationList, /openingSessionId === conversation\.sessionId/);

  // The rows a visitor is most likely to reopen are warmed while they read.
  assert.match(widgetRuntime, /const PREFETCHED_CONVERSATIONS = 3/);
  assert.match(
    widgetRuntime,
    /conversations\s*\.slice\(0, PREFETCHED_CONVERSATIONS\)/,
  );
  // A turn rewrites the transcript, so its cached copy must not survive it.
  assert.match(
    widgetRuntime,
    /conversationCacheRef\.current\.delete\(activeSessionId\)/,
  );

  // View switches must not queue one animation behind another's full duration.
  for (const view of [conversationList, messagesTab, homeTab, contactTab]) {
    assert.match(view, /exit=\{\{[^}]*transition: \{ duration: 0\.12 \}/);
  }

  // Attachments are restored with one table read and one signing batch.
  assert.match(historyRoute, /createSignedUrls\(paths, ATTACHMENT_SIGNED_URL_TTL_SECONDS\)/);
  assert.doesNotMatch(historyRoute, /createSignedUrl\(/);
  assert.equal(historyRoute.match(/restoreTranscriptAttachments\(/g)?.length, 2);
});

test("conversation history uses a compact list, skeleton loading, and one empty-state action", () => {
  assert.match(conversationList, /aria-label=\{copy\.loading\}/);
  assert.match(conversationList, /\[0, 1, 2\]\.map/);
  assert.match(conversationList, /overflow-hidden rounded-2xl border/);
  assert.doesNotMatch(conversationList, /border-dashed/);
  assert.match(conversationList, /conversations\.length > 0/);
});

test("home messages and starter prompts use one direct conversation-start path", () => {
  assert.doesNotMatch(homeTab, /onSwitchToMessages/);
  assert.doesNotMatch(homeTab, /onSendMessage/);
  assert.equal(homeTab.match(/onStartConversation\(/g)?.length, 2);
  assert.match(
    homeTab,
    /if \(!trimmedPrompt\) return;[\s\S]*onStartConversation\(trimmedPrompt\)/,
  );
  assert.match(
    homeTab,
    /if \(text\?\.trim\(\)\) \{\s*onStartConversation\(text\.trim\(\)\);\s*\}/,
  );
  assert.match(widgetRuntime, /const nextSessionId = resetConversation\(\)/);
  assert.match(widgetRuntime, /sessionId: nextSessionId/);
  assert.match(widgetRuntime, /sessionId: activeSessionId/);
  assert.match(widgetRuntime, /activeStreamAbortControllerRef\.current/);
});

test("the active-chat header returns to history without resetting the conversation", () => {
  assert.doesNotMatch(widgetRuntime, /RotateCcw/);
  assert.match(
    widgetRuntime,
    /\(hasStarted \|\| conversations\.length > 0\)/,
  );
  assert.match(
    widgetRuntime,
    /disabled=\{isLoading \|\| isStreaming \|\| isUploadingAttachment\}/,
  );
  assert.match(widgetRuntime, /aria-label=\{historyLabel\}/);
  assert.match(
    widgetRuntime,
    /armInactivityTimer\([\s\S]*activeSessionId,[\s\S]*\)/,
  );
});
