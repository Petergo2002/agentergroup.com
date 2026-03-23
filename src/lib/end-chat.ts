import type {
  BuilderDefinition,
  ConversationEndReason,
  EndChatMetadata,
  EndChatPolicy,
} from "@/lib/types";

export const DEFAULT_END_CHAT_INACTIVITY_TIMEOUT_SECONDS = 120;

export function buildDisabledEndChatPolicy(): EndChatPolicy {
  return {
    enabled: false,
    inactivityTimeoutSeconds: null,
    allowAssistantSuggestion: false,
  };
}

export function buildDefaultEndChatPolicy(): EndChatPolicy {
  return {
    enabled: true,
    inactivityTimeoutSeconds: DEFAULT_END_CHAT_INACTIVITY_TIMEOUT_SECONDS,
    allowAssistantSuggestion: true,
  };
}

export function normalizeEndChatTimeout(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const nextValue = Math.round(value);
  return nextValue > 0 ? nextValue : null;
}

export function extractEndChatPolicyFromNodes(nodes: unknown[] | null | undefined): EndChatPolicy {
  if (!Array.isArray(nodes)) {
    return buildDisabledEndChatPolicy();
  }

  const match = nodes.find((node) => {
    if (!node || typeof node !== "object") {
      return false;
    }

    const data = (node as { data?: Record<string, unknown> }).data;
    return data?.kind === "endchat";
  }) as
    | {
        data?: {
          inactivityTimeoutSeconds?: unknown;
          allowAssistantSuggestion?: unknown;
        };
      }
    | undefined;

  if (!match?.data) {
    return buildDisabledEndChatPolicy();
  }

  return {
    enabled: true,
    inactivityTimeoutSeconds: normalizeEndChatTimeout(
      match.data.inactivityTimeoutSeconds,
    ),
    allowAssistantSuggestion:
      typeof match.data.allowAssistantSuggestion === "boolean"
        ? match.data.allowAssistantSuggestion
        : true,
  };
}

export function extractEndChatPolicyFromDefinition(
  definition: BuilderDefinition | null | undefined,
): EndChatPolicy {
  return extractEndChatPolicyFromNodes(definition?.nodes);
}

export function buildEndChatMetadata(input: {
  suggested: boolean;
  sessionCompleted: boolean;
  reason: ConversationEndReason | null;
  source: "assistant" | "system";
  summary?: string | null;
}): EndChatMetadata {
  return {
    suggested: input.suggested,
    sessionCompleted: input.sessionCompleted,
    reason: input.reason,
    source: input.source,
    summary: input.summary ?? null,
  };
}
