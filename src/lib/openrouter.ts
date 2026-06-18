import {
  getOpenRouterModel,
  getOpenRouterProviderPreferences,
  hasOpenRouterEnv,
} from "@/lib/env";

interface OpenRouterChatOptions {
  model?: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  responseFormat?: Record<string, unknown>;
  stream?: boolean;
  signal?: AbortSignal;
}

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
}: OpenRouterChatOptions) {
  if (!hasOpenRouterEnv()) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
    signal,
  });

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
    return streamOpenRouterResponse(response);
  }

  return response.json();
}

export async function* streamOpenRouterResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

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

    return { done: false, chunk: parsed } as const;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
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
        if (event.chunk) {
          yield event.chunk;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseLine(buffer);
      if (event.chunk) {
        yield event.chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
