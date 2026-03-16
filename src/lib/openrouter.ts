import { getOpenRouterModel, hasOpenRouterEnv } from "@/lib/env";

interface OpenRouterChatOptions {
  model?: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
}

export async function createOpenRouterChatCompletion({
  model,
  messages,
  tools = [],
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
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      "OpenRouter request failed.";
    throw new Error(message);
  }

  return payload;
}
