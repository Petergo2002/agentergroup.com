import { getOpenRouterModel, hasOpenRouterEnv } from "@/lib/env";

interface OpenRouterChatOptions {
  model?: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  stream?: boolean;
}

export async function createOpenRouterChatCompletion({
  model,
  messages,
  tools = [],
  stream = false,
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
      stream,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error?.message ||
      payload?.message ||
      "OpenRouter request failed.";
    throw new Error(message);
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
        if (line.trim() === "") continue;
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            // Ignore incomplete or unparseable chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
