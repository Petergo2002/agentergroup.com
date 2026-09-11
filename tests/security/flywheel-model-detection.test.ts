import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { detectUnansweredQueryCandidate } from "../../src/lib/flywheel/detection.ts";

const runtimeSource = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");
const widgetChatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);

test("a model-reported gap outranks the prose heuristics", () => {
  // Real production miss: no "?", no wh-word, and "networth" is not in the
  // keyword list, so the patterns reject it as "not concrete enough".
  const result = detectUnansweredQueryCandidate({
    question: "i want to know the networth",
    assistantAnswer: "I don't have access to that kind of financial data.",
    knowledgeMatchCount: 3,
    modelFlaggedGap: {
      question: "What is the company's net worth?",
      reason: "No financial data in knowledge",
    },
  });

  assert.equal(result.shouldCreate, true);
  assert.equal(result.source, "model_tool");
  assert.equal(result.confidence, 0.95);
  // The model's standalone rewrite is preferred over the raw visitor wording.
  assert.equal(result.question, "What is the company's net worth?");
  // ...and the legacy detector is still scored, for comparison.
  assert.equal(result.patternWouldCreate, false);
});

test("a warm deflection into lead capture is caught", () => {
  // The Milo personality instructs deflecting warmly instead of saying
  // "I don't know", which matches none of the fallback patterns.
  const deflection =
    "Great question! Let me get someone from the team to send you exact pricing. What's your email?";

  const withTool = detectUnansweredQueryCandidate({
    question: "What does the premium plan cost?",
    assistantAnswer: deflection,
    knowledgeMatchCount: 3,
    modelFlaggedGap: { question: "What does the premium plan cost?" },
  });
  assert.equal(withTool.shouldCreate, true);
  assert.equal(withTool.source, "model_tool");

  // Documents the residual gap: without the tool call this is still missed.
  const withoutTool = detectUnansweredQueryCandidate({
    question: "What does the premium plan cost?",
    assistantAnswer: deflection,
    knowledgeMatchCount: 3,
  });
  assert.equal(withoutTool.shouldCreate, false);
});

test("a follow-up question is stored as a standalone question", () => {
  const result = detectUnansweredQueryCandidate({
    question: "what year?",
    assistantAnswer: "I still don't have the specific year in my knowledge base.",
    knowledgeMatchCount: 3,
    modelFlaggedGap: {
      question: "What year did Agenter Group release its SaaS platform?",
    },
  });

  assert.equal(result.shouldCreate, true);
  assert.equal(
    result.question,
    "What year did Agenter Group release its SaaS platform?",
  );
});

test("the legacy patterns still run when the model stays silent", () => {
  const classic = detectUnansweredQueryCandidate({
    question: "what is networth of this compnay?",
    assistantAnswer:
      "I'm sorry, I don't have access to information about the company's net worth.",
    knowledgeMatchCount: 3,
  });
  assert.equal(classic.shouldCreate, true);
  assert.equal(classic.source, "fallback_pattern");
  assert.equal(classic.patternWouldCreate, true);

  const answered = detectUnansweredQueryCandidate({
    question: "Do you support Shopify?",
    assistantAnswer: "Yes! Milo integrates with Shopify out of the box.",
    knowledgeMatchCount: 3,
  });
  assert.equal(answered.shouldCreate, false);

  const greeting = detectUnansweredQueryCandidate({
    question: "Hello",
    assistantAnswer: "Hi there! I'm Milo.",
    knowledgeMatchCount: 3,
  });
  assert.equal(greeting.shouldCreate, false);
});

test("an empty model flag does not fabricate a capture", () => {
  const result = detectUnansweredQueryCandidate({
    question: "Hello",
    assistantAnswer: "Hi there!",
    knowledgeMatchCount: 3,
    modelFlaggedGap: { question: "   ", reason: null },
  });

  // Blank question falls through to the heuristics rather than capturing noise.
  assert.equal(result.source, "none");
  assert.equal(result.shouldCreate, false);
});

test("both detector verdicts are recorded on every capture", () => {
  assert.match(widgetChatRoute, /modelFlaggedGap: result\.knowledgeGap/);
  assert.match(widgetChatRoute, /detectionSource: detection\.source/);
  assert.match(widgetChatRoute, /patternWouldCreate: detection\.patternWouldCreate/);
});

test("the runtime exposes the gap tool without letting it end the chat", () => {
  assert.match(runtimeSource, /flag_missing_knowledge/);
  assert.match(runtimeSource, /INTERNAL_FLAG_KNOWLEDGE_GAP_TOOL_DEFINITION,/);
  assert.match(runtimeSource, /buildKnowledgeGapGuidance\(\)/);

  // Only the end-chat tool may complete a session. This previously keyed off
  // "any internal tool", so create_pdf silently ended the conversation.
  assert.match(
    runtimeSource,
    /const endChatToolCall = internalToolCalls\.find\([\s\S]*?INTERNAL_END_CHAT_TOOL_NAME,?\s*\);/,
  );
  assert.match(runtimeSource, /if \(endChatToolCall && !endChat\)/);
  assert.doesNotMatch(runtimeSource, /if \(internalToolCalls\.length > 0 && !endChat\)/);

  // Internal tool names live in one set so the two filters cannot drift apart.
  assert.match(runtimeSource, /const INTERNAL_TOOL_NAMES = new Set\(\[/);
  assert.equal(
    runtimeSource.match(/INTERNAL_TOOL_NAMES\.has\(/g)?.length,
    2,
    "both the internal and external tool filters should use the shared set",
  );

  // The control-signal tool result is not persisted as conversation content.
  assert.match(
    runtimeSource,
    /message\.name !== INTERNAL_FLAG_KNOWLEDGE_GAP_TOOL_NAME/,
  );
});
