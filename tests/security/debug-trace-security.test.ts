import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConversationDetailForViewer,
  buildPersistedAssistantMetadata,
  buildPersistedDebugTrace,
  buildPersistedRunOutput,
  buildPersistedToolMessages,
  canViewDebugTrace,
} from "../../src/lib/debug-trace-security.ts";

const rawDebugTrace = {
  durationMs: 123,
  iterationsUsed: 1,
  toolsAvailable: ["gmail_send_email"],
  knowledgeHits: 0,
  events: [
    {
      type: "tool_call" as const,
      ts: 5,
      name: "gmail_send_email",
      args: {
        email: "person@example.com",
      },
    },
    {
      type: "tool_result" as const,
      ts: 20,
      name: "gmail_send_email",
      result: {
        threadId: "secret-thread",
      },
    },
  ],
  hadError: false,
};

test("production persistence drops debug traces and raw tool payloads", () => {
  const persistedDebugTrace = buildPersistedDebugTrace(
    rawDebugTrace,
    "production",
  );
  const persistedAssistantMetadata = buildPersistedAssistantMetadata(
    {
      responseId: "msg_123",
      debugTrace: rawDebugTrace,
    },
    "production",
  );
  const persistedToolMessages = buildPersistedToolMessages(
    [
      {
        role: "tool",
        tool_call_id: "call_123",
        name: "gmail_send_email",
        content: "{\"email\":\"person@example.com\"}",
        generated_file: {
          data_base64: "sensitive",
        },
      },
    ],
    "production",
  );
  const persistedRunOutput = buildPersistedRunOutput(
    {
      finalCompletion: {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: "{\"email\":\"person@example.com\"}",
                  },
                },
              ],
            },
          },
        ],
      },
      toolMessages: [
        {
          role: "tool",
          tool_call_id: "call_123",
          name: "gmail_send_email",
          content: "{\"email\":\"person@example.com\"}",
        },
      ],
      knowledgeMatches: [],
    },
    "production",
  );

  assert.equal(persistedDebugTrace, null);
  assert.deepEqual(persistedAssistantMetadata, {
    responseId: "msg_123",
  });
  assert.deepEqual(persistedToolMessages, [
    {
      role: "tool",
      tool_call_id: "call_123",
      name: "gmail_send_email",
      content:
        "Tool gmail_send_email executed. Raw tool payloads are not stored in production.",
    },
  ]);
  assert.equal(persistedRunOutput.finalCompletion, null);
  assert.deepEqual(persistedRunOutput.toolMessages, persistedToolMessages);
});

test("analytics conversation detail strips debug traces for non-admin viewers", () => {
  const detail = {
    conversation: {
      widgetSessionId: "session-1",
      sessionId: "public-session-1",
      widgetId: "widget-1",
      widgetName: "Support",
      widgetPublicKey: "pk_123",
      widgetAgentId: "widget-agent-1",
      agentId: "agent-1",
      agentName: "Helper",
      agentLabel: "Helper",
      source: "embedded" as const,
      startedAt: "2026-04-07T10:00:00.000Z",
      lastActivityAt: "2026-04-07T10:05:00.000Z",
      pageUrl: "https://example.com",
      referrer: null,
    },
    lead: null,
    transcript: [
      {
        id: "msg-1",
        role: "assistant" as const,
        content: "Done.",
        createdAt: "2026-04-07T10:05:00.000Z",
        debugTrace: rawDebugTrace,
      },
    ],
    identitySummary: {
      name: null,
      email: null,
      phone: null,
    },
  };

  assert.equal(canViewDebugTrace("owner"), true);
  assert.equal(canViewDebugTrace("admin"), true);
  assert.equal(canViewDebugTrace("member"), false);

  const memberView = buildConversationDetailForViewer(detail, "member");
  const adminView = buildConversationDetailForViewer(detail, "admin");

  assert.equal(memberView.transcript[0]?.debugTrace, null);
  assert.deepEqual(adminView.transcript[0]?.debugTrace, rawDebugTrace);
});
