import type { AgentSurface } from "@/lib/types";

interface CreateAgentInput {
  name: string;
  surface: AgentSurface;
}

interface CreateAgentResponse {
  id: string;
}

interface ErrorResponse {
  error?: unknown;
  code?: unknown;
}

export class AgentCreationError extends Error {
  code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "AgentCreationError";
    this.code = code;
  }
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function createAgent(input: CreateAgentInput): Promise<CreateAgentResponse> {
  const response = await fetch("/api/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      name: input.name,
      surface: input.surface,
      timezone: getBrowserTimezone(),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorResponse &
    Partial<CreateAgentResponse>;

  if (!response.ok) {
    throw new AgentCreationError(
      typeof payload.error === "string" && payload.error
        ? payload.error
        : "Failed to create agent.",
      typeof payload.code === "string" ? payload.code : null,
    );
  }

  if (typeof payload.id !== "string" || !payload.id) {
    throw new AgentCreationError("The server returned an invalid agent response.");
  }

  return { id: payload.id };
}
