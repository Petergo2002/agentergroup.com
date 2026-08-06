import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const previewPage = readFileSync(
  "src/app/(app)/agents/[id]/preview/page.tsx",
  "utf8",
);
const assistantPage = readFileSync(
  "src/app/(app)/assistants/[id]/page.tsx",
  "utf8",
);
const previewRoute = readFileSync(
  "src/app/api/agents/[id]/chat/route.ts",
  "utf8",
);
const assistantRoute = readFileSync(
  "src/app/api/assistants/[id]/chat/route.ts",
  "utf8",
);
const runtime = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");

test("authenticated chat routes propagate request cancellation to the runtime", () => {
  assert.match(previewRoute, /abortSignal: request\.signal/);
  assert.match(assistantRoute, /abortSignal: request\.signal/);
});

test("knowledge retrieval has a bounded wait and preserves request cancellation", () => {
  assert.match(runtime, /const KNOWLEDGE_SEARCH_TIMEOUT_MS = 8_000/);
  assert.match(runtime, /AbortSignal\.timeout\(KNOWLEDGE_SEARCH_TIMEOUT_MS\)/);
  assert.match(runtime, /AbortSignal\.any\(\[abortSignal, timeoutSignal\]\)/);
  assert.match(runtime, /signal: searchSignal/);
  assert.match(runtime, /if \(abortSignal\?\.aborted\) \{\s*throw error;/);
});

test("preview renders optimistic user and assistant messages before the request", () => {
  const handlerStart = previewPage.indexOf("const handleSendMessage = async");
  const handlerEnd = previewPage.indexOf("const surfaceLabel", handlerStart);
  const handler = previewPage.slice(handlerStart, handlerEnd);
  const optimisticRender = handler.indexOf("setMessages((current) => [");
  const requestStart = handler.indexOf("const response = await fetch(");

  assert.ok(optimisticRender >= 0);
  assert.ok(requestStart > optimisticRender);
  assert.match(handler, /id: streamingAssistantId/);
  assert.doesNotMatch(handler, /await createThread\(/);
  assert.match(handler, /threadId: activeThreadId \?\? undefined/);
});

test("assistant renders its pending response before waiting for the request", () => {
  const handlerStart = assistantPage.indexOf("const handleSendMessage = async");
  const handlerEnd = assistantPage.indexOf("return (", handlerStart);
  const handler = assistantPage.slice(handlerStart, handlerEnd);
  const optimisticRender = handler.indexOf("setDetail((current) =>");
  const requestStart = handler.indexOf("const response = await fetch(");

  assert.ok(optimisticRender >= 0);
  assert.ok(requestStart > optimisticRender);
  assert.match(handler.slice(optimisticRender, requestStart), /id: streamingAssistantId/);
});

test("independent pre-runtime audit and history operations run concurrently", () => {
  for (const source of [previewRoute, assistantRoute]) {
    assert.match(
      source,
      /const \[, persistUserStep\] = await Promise\.all\(\[/,
    );
    assert.match(
      source,
      /const \[historyStep, \{ data: history, error: historyError \}\] =\s*await Promise\.all\(\[/,
    );
  }
});
