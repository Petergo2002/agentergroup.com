import type {
  AutomationActionResult,
  AutomationDecision,
  AutomationGeneratedMessage,
  AutomationRunResult,
} from "../types/automation.ts";

interface ToolMessageLike {
  content?: unknown;
  name?: unknown;
}

interface BuildAutomationRunResultInput {
  assistantContent: string;
  toolMessages: ToolMessageLike[];
  runtimeHadError?: boolean;
  runtimeErrorSummary?: string | null;
}

interface ModelAutomationReport {
  decision?: unknown;
  summary?: unknown;
  reason?: unknown;
  missingInformation?: unknown;
  generatedMessage?: unknown;
}

const DECISIONS = new Set<AutomationDecision>([
  "action_taken",
  "no_action",
  "needs_input",
  "action_failed",
]);

const TOOL_LABELS: Record<string, string> = {
  GMAIL_REPLY_TO_THREAD: "Replied in Gmail thread",
  GMAIL_SEND_EMAIL: "Sent Gmail email",
  OUTLOOK_SEND_EMAIL: "Sent Outlook email",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, maxLength = 800) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanMultilineText(value: unknown, maxLength = 4_000) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function readGeneratedMessage(value: unknown): AutomationGeneratedMessage | null {
  if (!isRecord(value)) return null;

  const cleanNullableText = (input: unknown, maxLength: number) => {
    const text = cleanText(input, maxLength);
    return text && text.toLowerCase() !== "null" ? text : null;
  };
  const rawType = typeof value.type === "string" ? value.type : "message";
  const type: AutomationGeneratedMessage["type"] =
    rawType === "email" || rawType === "reply" || rawType === "message"
      ? rawType
      : "message";
  const to = cleanNullableText(value.to, 500);
  const subject = cleanNullableText(value.subject, 500);
  const body = cleanMultilineText(value.body);

  if (!to && !subject && !body) return null;

  return {
    type,
    to,
    subject,
    body,
  };
}

function parseJsonRecord(value: string) {
  const trimmed = value.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isRecord(parsed)) return parsed;
    } catch {
      // The runtime still supports legacy free-form summaries.
    }
  }

  return null;
}

function parseModelReport(content: string): ModelAutomationReport | null {
  return parseJsonRecord(content) as ModelAutomationReport | null;
}

function prettifyToolName(toolName: string) {
  return TOOL_LABELS[toolName] ?? toolName
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function findIdentifier(value: unknown, keys: Set<string>): string | null {
  if (!isRecord(value)) return null;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(key) && (typeof nestedValue === "string" || typeof nestedValue === "number")) {
      return String(nestedValue).slice(0, 120);
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (isRecord(nestedValue)) {
      const match = findIdentifier(nestedValue, keys);
      if (match) return match;
    }
  }

  return null;
}

function readSafeIdentifiers(content: string) {
  const parsed = parseJsonRecord(content);
  if (!parsed) return { threadId: null, messageId: null };

  return {
    threadId: findIdentifier(parsed, new Set(["thread_id", "threadId"])),
    messageId: findIdentifier(parsed, new Set(["message_id", "messageId"])),
  };
}

function containsFailureSignal(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsFailureSignal(item, depth + 1));
  }
  if (!isRecord(value)) return false;
  if (value.successful === false || value.success === false) return true;
  if (Boolean(cleanText(value.error, 280))) return true;

  return Object.values(value).some((nestedValue) =>
    containsFailureSignal(nestedValue, depth + 1),
  );
}

function findOperationalError(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findOperationalError(item, depth + 1);
      if (match) return match;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  for (const key of ["error", "error_message", "errorMessage"]) {
    const direct = cleanText(value[key], 600);
    if (direct) return direct;
  }

  for (const nestedValue of Object.values(value)) {
    const match = findOperationalError(nestedValue, depth + 1);
    if (match) return match;
  }

  return null;
}

function redactOperationalError(content: string) {
  return content
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url redacted]')
    .replace(/\b(?:authorization|bearer|token|api[_ -]?key|secret)\s*[:=]?\s*[^\s,;]+/gi, '[credential redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function readOperationalError(content: string) {
  const prefixedError = content.match(/^(?:error executing tool:|tool failed:)\s*(.*)$/i)?.[1];
  if (prefixedError) return redactOperationalError(prefixedError);

  const parsed = parseJsonRecord(content);
  const nestedError = parsed ? findOperationalError(parsed) : null;
  return nestedError ? redactOperationalError(nestedError) : null;
}

function isFailedToolContent(content: string) {
  if (!content.trim()) return true;
  if (/^(error executing tool:|tool failed:)/i.test(content)) return true;
  if (/tool executed, but no result was returned/i.test(content)) return true;

  const parsed = parseJsonRecord(content);
  return parsed ? containsFailureSignal(parsed) : false;
}

function buildAction(message: ToolMessageLike): AutomationActionResult | null {
  const toolName = cleanText(message.name, 120);
  if (!toolName) return null;

  const content = cleanText(message.content, 2_000) ?? "";
  const failed = isFailedToolContent(content);
  const identifiers = readSafeIdentifiers(content);
  const identifierDetail = [
    identifiers.threadId ? `Thread ${identifiers.threadId}` : null,
    identifiers.messageId ? `Message ${identifiers.messageId}` : null,
  ].filter(Boolean).join(" · ");

  return {
    toolName,
    label: prettifyToolName(toolName),
    status: failed ? "failed" : "succeeded",
    detail: failed
      ? readOperationalError(content) || "The action failed without a safe error message."
      : identifierDetail || "Action completed successfully.",
    threadId: identifiers.threadId,
    messageId: identifiers.messageId,
  };
}

function readModelDecision(value: unknown): AutomationDecision | null {
  return typeof value === "string" && DECISIONS.has(value as AutomationDecision)
    ? (value as AutomationDecision)
    : null;
}

export function buildAutomationRunResult({
  assistantContent,
  toolMessages,
  runtimeHadError = false,
  runtimeErrorSummary = null,
}: BuildAutomationRunResultInput): AutomationRunResult {
  const modelReport = parseModelReport(assistantContent);
  const actions = toolMessages
    .map(buildAction)
    .filter((action): action is AutomationActionResult => Boolean(action));
  const failedActions = actions.filter((action) => action.status === "failed");
  const succeededActions = actions.filter((action) => action.status === "succeeded");
  const modelDecision = readModelDecision(modelReport?.decision);

  let decision: AutomationDecision;
  if (failedActions.length > 0 || runtimeHadError) {
    decision = "action_failed";
  } else if (succeededActions.length > 0) {
    decision = "action_taken";
  } else if (modelDecision === "needs_input") {
    decision = "needs_input";
  } else {
    decision = "no_action";
  }

  const legacySummary = modelReport ? null : cleanText(assistantContent, 1_200);
  const summary = cleanText(modelReport?.summary, 1_200) ?? legacySummary ??
    (decision === "no_action"
      ? "The event was reviewed and no external action was required."
      : "The automation run completed without a summary.");
  const defaultReason = decision === "action_taken"
    ? `${succeededActions.length} configured action${succeededActions.length === 1 ? "" : "s"} completed.`
    : decision === "action_failed"
      ? runtimeErrorSummary ?? `${failedActions.length || 1} action failed and requires attention.`
      : decision === "needs_input"
        ? "The event did not contain enough information to act safely."
        : "No configured action was needed for this event.";
  const missingInformation = Array.isArray(modelReport?.missingInformation)
    ? modelReport.missingInformation
        .map((item) => cleanText(item, 160))
        .filter((item): item is string => Boolean(item))
        .slice(0, 8)
    : [];

  return {
    version: 1,
    decision,
    summary,
    reason: cleanText(modelReport?.reason, 500) ?? defaultReason,
    missingInformation,
    actions,
    generatedMessage: readGeneratedMessage(modelReport?.generatedMessage),
  };
}

export function readAutomationRunResult(value: unknown): AutomationRunResult | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const decision = readModelDecision(value.decision);
  if (!decision || typeof value.summary !== "string" || typeof value.reason !== "string") {
    return null;
  }

  const actions = Array.isArray(value.actions)
    ? value.actions.flatMap((action) => {
        if (
          !isRecord(action) ||
          typeof action.toolName !== "string" ||
          typeof action.label !== "string" ||
          (action.status !== "succeeded" && action.status !== "failed") ||
          typeof action.detail !== "string"
        ) {
          return [];
        }

        return [{
          toolName: action.toolName,
          label: action.label,
          status: action.status,
          detail: action.detail,
          threadId: typeof action.threadId === "string" ? action.threadId : null,
          messageId: typeof action.messageId === "string" ? action.messageId : null,
        } satisfies AutomationActionResult];
      })
    : [];
  const missingInformation = Array.isArray(value.missingInformation)
    ? value.missingInformation.filter((item): item is string => typeof item === "string")
    : [];

  return {
    version: 1,
    decision,
    summary: value.summary,
    reason: value.reason,
    missingInformation,
    actions,
    generatedMessage: readGeneratedMessage(value.generatedMessage),
  };
}
