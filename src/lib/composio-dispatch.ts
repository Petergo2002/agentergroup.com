import type OpenAI from "openai";

export type ExecutableToolCall = OpenAI.Chat.ChatCompletionMessageFunctionToolCall;

export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  name: string;
  content: string;
}

/** The slice of the Composio provider this module needs. */
export interface ToolCallExecutor {
  executeToolCall(
    userId: string,
    toolCall: ExecutableToolCall,
    options?: unknown,
    modifiers?: unknown,
  ): Promise<string>;
}

/** Every function call the model asked for, across all choices, in order. */
export function getExecutableToolCalls(
  chatCompletion: OpenAI.Chat.ChatCompletion,
): ExecutableToolCall[] {
  return chatCompletion.choices.flatMap((choice) => {
    const toolCalls = choice.message?.tool_calls;
    if (!Array.isArray(toolCalls)) {
      return [];
    }

    return toolCalls.filter(
      (toolCall): toolCall is ExecutableToolCall => toolCall.type === "function",
    );
  });
}

async function executeOneToolCall(
  provider: ToolCallExecutor,
  userId: string,
  toolCall: ExecutableToolCall,
): Promise<ToolResultMessage> {
  const content = await provider.executeToolCall(userId, toolCall);

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content,
  };
}

function buildToolErrorMessage(
  toolCall: ExecutableToolCall,
  error: unknown,
): ToolResultMessage {
  const message =
    error instanceof Error ? error.message : "Unknown integration error";

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content: JSON.stringify({ successful: false, error: message }),
  };
}

/** Composio errors that a fresh tool-router session is likely to resolve. */
export function isRecoverableSessionError(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  const message = String((error as { message: unknown }).message).toLowerCase();

  return (
    message.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("not found")
  );
}

/**
 * Runs every tool call the model asked for and returns one result per call.
 *
 * The provider's own `handleToolCalls` walks the completion's `choices` but
 * only ever executes `tool_calls[0]` within each one, so a turn that books an
 * event *and* sends the confirmation silently drops the confirmation — and
 * hands back a transcript with more calls than results, which the next model
 * call rejects.
 */
export async function dispatchToolCalls({
  provider,
  userId,
  toolCalls,
  recreateSession,
}: {
  provider: ToolCallExecutor;
  userId: string;
  toolCalls: ExecutableToolCall[];
  recreateSession: () => Promise<boolean>;
}) {
  const results: ToolResultMessage[] = [];
  let sessionWasRecreated = false;
  let hadToolFailure = false;

  for (const toolCall of toolCalls) {
    try {
      results.push(await executeOneToolCall(provider, userId, toolCall));
      continue;
    } catch (error) {
      // Recreate the session at most once per turn, and only retry the call
      // that failed — replaying the whole batch would repeat the side effects
      // of calls that already succeeded.
      if (isRecoverableSessionError(error) && !sessionWasRecreated) {
        console.warn(
          "[Composio] Session appears missing or expired, attempting recreation...",
          userId,
        );

        if (await recreateSession()) {
          sessionWasRecreated = true;

          try {
            results.push(await executeOneToolCall(provider, userId, toolCall));
            continue;
          } catch (retryError) {
            console.error(
              `[Composio] Tool call ${toolCall.function.name} failed after session recreation:`,
              retryError,
            );
          }
        }
      } else {
        console.error(
          `[Composio] Tool call ${toolCall.function.name} failed:`,
          error,
        );
      }

      hadToolFailure = true;
      results.push(buildToolErrorMessage(toolCall, error));
    }
  }

  return { results, sessionWasRecreated, hadToolFailure };
}
