import type {
  BuilderDefinition,
  GmailBuilderNodeData,
  GmailRecipientPolicy,
} from "@/lib/types";

const DEFAULT_GMAIL_RECIPIENT_POLICY: GmailRecipientPolicy = {
  mode: "ai_decides",
  specificEmail: null,
};

export function buildDefaultGmailRecipientPolicy(): GmailRecipientPolicy {
  return { ...DEFAULT_GMAIL_RECIPIENT_POLICY };
}

export function normalizeGmailRecipientEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function extractGmailRecipientPolicyFromNodes(
  nodes: unknown[] | null | undefined,
): GmailRecipientPolicy {
  if (!Array.isArray(nodes)) {
    return buildDefaultGmailRecipientPolicy();
  }

  const emailNode = nodes.find((node) => {
    if (!node || typeof node !== "object") {
      return false;
    }

    const data = (node as { data?: { kind?: unknown } }).data;
    return data?.kind === "gmail" || data?.kind === "outlook";
  }) as { data?: Partial<GmailBuilderNodeData> } | undefined;

  if (!emailNode?.data) {
    return buildDefaultGmailRecipientPolicy();
  }

  const mode =
    emailNode.data.recipientMode === "specific_email"
      ? "specific_email"
      : "ai_decides";

  return {
    mode,
    specificEmail: normalizeGmailRecipientEmail(emailNode.data.recipientEmail),
  };
}

export function extractGmailRecipientPolicyFromDefinition(
  definition: BuilderDefinition | null | undefined,
) {
  return extractGmailRecipientPolicyFromNodes(definition?.nodes);
}
