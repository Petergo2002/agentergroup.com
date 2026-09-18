import {
  getOpenRouterModel,
  getOpenRouterProviderPreferences,
  hasOpenRouterEnv,
} from "./env.ts";

interface OpenRouterChatOptions {
  model?: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  responseFormat?: Record<string, unknown>;
  stream?: boolean;
  signal?: AbortSignal;
  /** Abort if response headers have not arrived. */
  connectTimeoutMs?: number;
  /** Abort if a streaming response goes this long without a chunk. */
  stallTimeoutMs?: number;
}

/**
 * A model call that never answered, as opposed to one the caller cancelled.
 *
 * The two have to stay distinguishable: a caller that treats every AbortError
 * as "the client went away" would swallow a hung upstream and end the response
 * silently, leaving the reader with a truncated reply and no explanation.
 */
export class OpenRouterTimeoutError extends Error {
  readonly phase: "connect" | "stall";
  readonly timeoutMs: number;

  constructor(phase: "connect" | "stall", timeoutMs: number) {
    super(
      phase === "connect"
        ? `OpenRouter did not respond within ${timeoutMs}ms.`
        : `OpenRouter stopped sending output for ${timeoutMs}ms.`,
    );
    this.name = "OpenRouterTimeoutError";
    this.phase = phase;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * No legitimate completion stalls this long: an idle stream is a dead upstream,
 * not a model thinking. Deliberately generous so a slow first token on a large
 * prompt is never mistaken for a hang.
 */
export const OPENROUTER_CONNECT_TIMEOUT_MS = 60_000;
export const OPENROUTER_STALL_TIMEOUT_MS = 60_000;

export class OpenRouterRequestError extends Error {
  status: number;
  code: string | number | null;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    input: {
      status: number;
      code?: string | number | null;
      retryAfterSeconds?: number | null;
    },
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }
}

export async function createOpenRouterChatCompletion({
  model,
  messages,
  tools = [],
  responseFormat,
  stream = false,
  signal,
  connectTimeoutMs = OPENROUTER_CONNECT_TIMEOUT_MS,
  stallTimeoutMs = OPENROUTER_STALL_TIMEOUT_MS,
}: OpenRouterChatOptions) {
  if (!hasOpenRouterEnv()) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  // One controller drives both timeouts and the caller's own cancellation, so
  // aborting actually tears down the socket instead of leaving a pending read.
  const controller = new AbortController();
  let timeoutError: OpenRouterTimeoutError | null = null;

  const abortWithTimeout = (phase: "connect" | "stall", timeoutMs: number) => {
    timeoutError = new OpenRouterTimeoutError(phase, timeoutMs);
    controller.abort(timeoutError);
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
    }
  }

  let connectTimer: ReturnType<typeof setTimeout> | null =
    connectTimeoutMs > 0
      ? setTimeout(
          () => abortWithTimeout("connect", connectTimeoutMs),
          connectTimeoutMs,
        )
      : null;

  const clearConnectTimer = () => {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  };

  let response: Response;

  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Agent Platform",
      },
      body: JSON.stringify({
        model: model || getOpenRouterModel(),
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        response_format: responseFormat,
        provider: {
          ...getOpenRouterProviderPreferences(),
          ...(responseFormat ? { require_parameters: true } : {}),
        },
        stream,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (timeoutError) {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearConnectTimer();
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error?.message ||
      payload?.message ||
      "OpenRouter request failed.";
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : null;
    throw new OpenRouterRequestError(message, {
      status: response.status,
      code:
        typeof payload?.error?.code === "string" ||
        typeof payload?.error?.code === "number"
          ? payload.error.code
          : null,
      retryAfterSeconds:
        typeof retryAfterSeconds === "number" &&
        Number.isFinite(retryAfterSeconds) &&
        retryAfterSeconds > 0
          ? retryAfterSeconds
          : null,
    });
  }

  if (stream) {
    return streamOpenRouterResponse(response, {
      stallTimeoutMs,
      onStall: (timeoutMs) => abortWithTimeout("stall", timeoutMs),
      getTimeoutError: () => timeoutError,
    });
  }

  return response.json();
}

export async function* streamOpenRouterResponse(
  response: Response,
  options?: {
    stallTimeoutMs?: number;
    onStall?: (timeoutMs: number) => void;
    getTimeoutError?: () => OpenRouterTimeoutError | null;
  },
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

  const stallTimeoutMs = options?.stallTimeoutMs ?? 0;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const clearStallTimer = () => {
    if (stallTimer !== null) {
      clearTimeout(stallTimer);
      stallTimer = null;
    }
  };

  // Armed around each read only. Firing aborts the request, which is what makes
  // the pending read reject instead of hanging for the whole function lifetime.
  const readChunk = async () => {
    if (stallTimeoutMs > 0 && options?.onStall) {
      clearStallTimer();
      stallTimer = setTimeout(() => {
        options.onStall?.(stallTimeoutMs);
      }, stallTimeoutMs);
    }

    try {
      return await reader.read();
    } catch (error) {
      const timeoutError = options?.getTimeoutError?.();
      if (timeoutError) {
        throw timeoutError;
      }
      throw error;
    } finally {
      clearStallTimer();
    }
  };

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  function parseLine(line: string) {
    const normalizedLine = line.trimEnd();
    if (!normalizedLine || normalizedLine.startsWith(":")) {
      return { done: false, chunk: null } as const;
    }

    if (!normalizedLine.startsWith("data:")) {
      return { done: false, chunk: null } as const;
    }

    const data = normalizedLine.slice(5).trimStart();
    if (data === "[DONE]") {
      return { done: true, chunk: null } as const;
    }

    let parsed: Record<string, unknown>;
    try {
      const candidate: unknown = JSON.parse(data);
      if (!candidate || typeof candidate !== "object") {
        throw new Error("OpenRouter returned a non-object stream payload.");
      }
      parsed = candidate as Record<string, unknown>;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("OpenRouter returned a malformed stream payload.", {
          cause: error,
        });
      }
      throw error;
    }

    const parsedError =
      parsed.error && typeof parsed.error === "object"
        ? (parsed.error as { message?: unknown })
        : null;
    const parsedChoices = parsed.choices;
    const streamErrorMessage =
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsedError?.message === "string"
          ? parsedError.message
          : typeof parsed.message === "string" && !Array.isArray(parsedChoices)
            ? parsed.message
            : null;
    const finishReason =
      Array.isArray(parsedChoices) &&
      parsedChoices[0] &&
      typeof parsedChoices[0] === "object" &&
      "finish_reason" in parsedChoices[0]
        ? (parsedChoices[0] as { finish_reason?: unknown }).finish_reason
        : null;

    if (streamErrorMessage) {
      throw new Error(streamErrorMessage);
    }

    if (finishReason === "error") {
      throw new Error("OpenRouter ended the response with an error.");
    }

    return {
      done: false,
      chunk: parsed,
      finishReason: typeof finishReason === "string" ? finishReason : null,
    } as const;
  }

  // A socket that simply ends is not a completed answer. Unless the provider
  // sent `[DONE]` or a finish reason, we cannot tell a finished reply from one
  // truncated mid-sentence — so treat a bare EOF as the failure it is rather
  // than persisting half an answer as if the model meant to stop there.
  let sawTerminalState = false;

  try {
    while (true) {
      const { done, value } = await readChunk();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseLine(line);
        if (event.done) {
          return;
        }
        if (event.finishReason) {
          sawTerminalState = true;
        }
        if (event.chunk) {
          yield event.chunk;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseLine(buffer);
      if (event.done) {
        return;
      }
      if (event.finishReason) {
        sawTerminalState = true;
      }
      if (event.chunk) {
        yield event.chunk;
      }
    }

    if (!sawTerminalState) {
      throw new Error(
        "OpenRouter ended the response before it was complete. The reply may be cut off.",
      );
    }
  } finally {
    clearStallTimer();
    reader.releaseLock();
  }
}
