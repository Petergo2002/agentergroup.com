const GMAIL_NEW_MESSAGE_TRIGGER = "GMAIL_NEW_GMAIL_MESSAGE";
const MAX_EMAIL_BODY_LENGTH = 12_000;
const MAX_FIELD_LENGTH = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function limit(value: string | null, maxLength = MAX_FIELD_LENGTH) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined),
  );
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 20).flatMap((attachment) => {
    if (!isRecord(attachment)) return [];

    return [
      compactRecord({
        filename: limit(readString(attachment.filename, attachment.name), 300),
        mimeType: limit(readString(attachment.mimeType, attachment.mime_type), 200),
        size: typeof attachment.size === "number" ? attachment.size : null,
      }),
    ];
  });
}

/**
 * Produces the minimum event context required by the automation runtime.
 * Gmail's raw MIME payload can contain thousands of transport headers and
 * encoded body copies; those are intentionally excluded from prompts and logs.
 */
export function normalizeAutomationTriggerPayload(
  triggerSlug: string,
  payload: Record<string, unknown>,
) {
  if (triggerSlug !== GMAIL_NEW_MESSAGE_TRIGGER) {
    return payload;
  }

  const preview = isRecord(payload.preview) ? payload.preview : {};
  const labelIds = Array.isArray(payload.label_ids)
    ? payload.label_ids
    : Array.isArray(payload.labelIds)
      ? payload.labelIds
      : [];
  const attachments = normalizeAttachments(
    payload.attachment_list ?? payload.attachmentList,
  );

  return compactRecord({
    messageId: limit(readString(payload.message_id, payload.messageId, payload.id), 300),
    threadId: limit(readString(payload.thread_id, payload.threadId), 300),
    sender: limit(readString(payload.sender, payload.from), 500),
    to: limit(readString(payload.to), 500),
    subject: limit(readString(payload.subject, preview.subject), 500),
    body: limit(
      readString(payload.message_text, payload.messageText, preview.body),
      MAX_EMAIL_BODY_LENGTH,
    ),
    timestamp: limit(
      readString(payload.message_timestamp, payload.messageTimestamp, payload.timestamp),
      100,
    ),
    labelIds: labelIds.filter((value): value is string => typeof value === "string").slice(0, 50),
    attachments,
  });
}
