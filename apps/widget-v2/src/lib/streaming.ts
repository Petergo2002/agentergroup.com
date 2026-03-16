interface ResolveStreamedAgentContentInput {
  previousContent: string;
  incomingContent: string;
  streaming: boolean;
}

type WidgetStreamMessage = {
  role: "user" | "agent";
  content: string;
  isStreaming?: boolean;
};

interface ShouldRevealInterimStreamContentInput {
  nowMs: number;
  streamStartedAtMs: number;
  minDelayMs: number;
  streamDone: boolean;
  hasRevealedInterimContent: boolean;
}

export function resolveStreamedAgentContent({
  previousContent,
  incomingContent,
  streaming,
}: ResolveStreamedAgentContentInput): string {
  if (!previousContent) return incomingContent;
  if (incomingContent.length >= previousContent.length) return incomingContent;
  if (!streaming) return incomingContent;
  return previousContent;
}

export function shouldRevealInterimStreamContent({
  nowMs,
  streamStartedAtMs,
  minDelayMs,
  streamDone,
  hasRevealedInterimContent,
}: ShouldRevealInterimStreamContentInput): boolean {
  if (streamDone) return true;
  if (hasRevealedInterimContent) return true;
  return nowMs - streamStartedAtMs >= minDelayMs;
}

export function applyStreamFailureToMessages(
  messages: WidgetStreamMessage[],
  fallbackContent: string,
): WidgetStreamMessage[] {
  if (messages.length === 0) {
    return [{ role: "agent", content: fallbackContent, isStreaming: false }];
  }

  const next = [...messages];
  const last = next[next.length - 1];
  if (last?.role === "agent" && last.isStreaming) {
    next[next.length - 1] = {
      ...last,
      content: fallbackContent,
      isStreaming: false,
    };
    return next;
  }

  return [
    ...next,
    { role: "agent", content: fallbackContent, isStreaming: false },
  ];
}
