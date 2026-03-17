

import { Composio } from "@composio/core";

async function main() {
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  
  const mockChatCompletion = {
    id: "mock_123",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc",
              type: "function",
              function: {
                name: "GOOGLECALENDAR_CREATE_EVENT",
                arguments: "{\n  \"summary\": \"Test Meeting\"\n}"
              }
            }
          ]
        },
        finish_reason: "tool_calls"
      }
    ]
  };

  try {
    // We don't have a real userId right now, but we can just see if it throws a formatting error.
    // If we get an unauthorized or no user error, that's fine. We are looking for parsing errors.
    console.log("Calling handleToolCalls...");
    const result = await composio.provider.handleToolCalls("mock_user_123", mockChatCompletion as any);
    console.log("Result:", result);
  } catch (error) {
    console.error("Caught error:", error);
  }
}

main().catch(console.error);
