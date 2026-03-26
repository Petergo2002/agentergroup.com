/** Validation helpers for public widget routes. */

const MAX_WIDGET_BODY_BYTES = 16 * 1024;
const MAX_SESSION_ID_LENGTH = 128;
const MAX_WIDGET_AGENT_ID_LENGTH = 128;
const MAX_CHAT_MESSAGE_LENGTH = 4000;
const MAX_NAME_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 32;
const MAX_LEAD_MESSAGE_LENGTH = 1000;
const MAX_PAGE_URL_LENGTH = 2048;
const MAX_REFERRER_LENGTH = 2048;
const MAX_OCCURRED_AT_LENGTH = 128;
const MAX_VISIBILITY_STATE_LENGTH = 64;
const MAX_METADATA_KEYS = 10;
const MAX_METADATA_VALUE_LENGTH = 512;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WIDGET_EVENT_TYPES = [
  "widget_open",
  "widget_close",
  "page_hidden",
  "page_visible",
  "page_unload",
  "heartbeat",
] as const;

type WidgetEventType = (typeof WIDGET_EVENT_TYPES)[number];

type ValidationSuccess<T> = {
  valid: true;
  value: T;
  error: null;
};

type ValidationFailure = {
  valid: false;
  error: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface WidgetChatBody {
  sessionId: string;
  message: string;
  widgetAgentId: string | null;
  pageUrl: string | null;
  referrer: string | null;
}

export interface WidgetLeadBody {
  sessionId: string;
  widgetAgentId: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
}

export interface WidgetEventBody {
  sessionId: string;
  eventType: WidgetEventType;
  metadata: Record<string, string>;
  pageUrl: string | null;
  referrer: string | null;
}

type Validator<T> = (input: unknown) => ValidationResult<T>;

function valid<T>(value: T): ValidationSuccess<T> {
  return {
    valid: true,
    value,
    error: null,
  };
}

function invalid<T>(error: string): ValidationResult<T> {
  return {
    valid: false,
    error,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): ValidationResult<string> {
  if (typeof value !== "string") {
    return invalid(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return invalid(`${fieldName} is required.`);
  }

  if (trimmed.length > maxLength) {
    return invalid(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return valid(trimmed);
}

function readOptionalString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): ValidationResult<string | null> {
  if (value === undefined || value === null) {
    return valid(null);
  }

  if (typeof value !== "string") {
    return invalid(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return valid(null);
  }

  if (trimmed.length > maxLength) {
    return invalid(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return valid(trimmed);
}

function readEmail(value: unknown): ValidationResult<string> {
  const emailResult = readRequiredString(value, "email", MAX_EMAIL_LENGTH);

  if (!emailResult.valid) {
    return emailResult;
  }

  if (!EMAIL_PATTERN.test(emailResult.value)) {
    return invalid("email must be a valid email address.");
  }

  return emailResult;
}

function normalizeMetadataValue(
  key: string,
  value: unknown,
): ValidationResult<string> {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return invalid(`metadata.${key} must be a string, number, or boolean.`);
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return invalid(`metadata.${key} cannot be empty.`);
  }

  if (normalized.length > MAX_METADATA_VALUE_LENGTH) {
    return invalid(
      `metadata.${key} must be ${MAX_METADATA_VALUE_LENGTH} characters or fewer.`,
    );
  }

  return valid(normalized);
}

function normalizeMetadata(
  value: unknown,
  legacyFields: Record<string, unknown>,
): ValidationResult<Record<string, string>> {
  const record = value === undefined ? {} : asRecord(value);

  if (value !== undefined && !record) {
    return invalid("metadata must be an object.");
  }

  const mergedEntries = Object.entries({
    ...(record ?? {}),
    ...legacyFields,
  }).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);

  if (mergedEntries.length > MAX_METADATA_KEYS) {
    return invalid(`metadata can contain at most ${MAX_METADATA_KEYS} keys.`);
  }

  const normalized: Record<string, string> = {};

  for (const [key, entryValue] of mergedEntries) {
    const trimmedKey = key.trim();

    if (!trimmedKey) {
      return invalid("metadata keys must be non-empty strings.");
    }

    const valueResult = normalizeMetadataValue(trimmedKey, entryValue);

    if (!valueResult.valid) {
      return valueResult;
    }

    normalized[trimmedKey] = valueResult.value;
  }

  return valid(normalized);
}

async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<ValidationResult<string>> {
  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return invalid(`Request body must be ${maxBytes} bytes or smaller.`);
    }
  }

  if (!request.body) {
    return valid("");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return invalid(`Request body must be ${maxBytes} bytes or smaller.`);
      }

      chunks.push(value);
    }
  } catch {
    return invalid("Request body could not be read.");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release failures after cancellation.
    }
  }

  if (totalBytes === 0) {
    return valid("");
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return valid(new TextDecoder("utf-8").decode(merged));
}

export async function validateBody<T>(
  request: Request,
  validator: Validator<T>,
): Promise<ValidationResult<T>> {
  const bodyResult = await readRequestBody(request, MAX_WIDGET_BODY_BYTES);

  if (!bodyResult.valid) {
    return bodyResult;
  }

  const trimmedBody = bodyResult.value.trim();
  let parsedBody: unknown = {};

  if (trimmedBody) {
    try {
      parsedBody = JSON.parse(bodyResult.value);
    } catch {
      return invalid("Request body must be valid JSON.");
    }
  }

  return validator(parsedBody);
}

export function validateWidgetChatBody(input: unknown): ValidationResult<WidgetChatBody> {
  const record = asRecord(input);

  if (!record) {
    return invalid("Request body must be a JSON object.");
  }

  const sessionIdResult = readRequiredString(
    record.sessionId,
    "sessionId",
    MAX_SESSION_ID_LENGTH,
  );
  if (!sessionIdResult.valid) {
    return sessionIdResult;
  }

  const messageResult = readRequiredString(
    record.message,
    "message",
    MAX_CHAT_MESSAGE_LENGTH,
  );
  if (!messageResult.valid) {
    return messageResult;
  }

  const widgetAgentIdResult = readOptionalString(
    record.widgetAgentId,
    "widgetAgentId",
    MAX_WIDGET_AGENT_ID_LENGTH,
  );
  if (!widgetAgentIdResult.valid) {
    return widgetAgentIdResult;
  }

  const pageUrlResult = readOptionalString(
    record.pageUrl,
    "pageUrl",
    MAX_PAGE_URL_LENGTH,
  );
  if (!pageUrlResult.valid) {
    return pageUrlResult;
  }

  const referrerResult = readOptionalString(
    record.referrer,
    "referrer",
    MAX_REFERRER_LENGTH,
  );
  if (!referrerResult.valid) {
    return referrerResult;
  }

  return valid({
    sessionId: sessionIdResult.value,
    message: messageResult.value,
    widgetAgentId: widgetAgentIdResult.value,
    pageUrl: pageUrlResult.value,
    referrer: referrerResult.value,
  });
}

export function validateWidgetLeadBody(input: unknown): ValidationResult<WidgetLeadBody> {
  const record = asRecord(input);

  if (!record) {
    return invalid("Request body must be a JSON object.");
  }

  const sessionIdResult = readRequiredString(
    record.sessionId,
    "sessionId",
    MAX_SESSION_ID_LENGTH,
  );
  if (!sessionIdResult.valid) {
    return sessionIdResult;
  }

  const widgetAgentIdResult = readOptionalString(
    record.widgetAgentId,
    "widgetAgentId",
    MAX_WIDGET_AGENT_ID_LENGTH,
  );
  if (!widgetAgentIdResult.valid) {
    return widgetAgentIdResult;
  }

  const nameResult = readRequiredString(record.name, "name", MAX_NAME_LENGTH);
  if (!nameResult.valid) {
    return nameResult;
  }

  const emailResult = readEmail(record.email);
  if (!emailResult.valid) {
    return emailResult;
  }

  const phoneResult = readOptionalString(record.phone, "phone", MAX_PHONE_LENGTH);
  if (!phoneResult.valid) {
    return phoneResult;
  }

  const messageResult = readOptionalString(
    record.message,
    "message",
    MAX_LEAD_MESSAGE_LENGTH,
  );
  if (!messageResult.valid) {
    return messageResult;
  }

  return valid({
    sessionId: sessionIdResult.value,
    widgetAgentId: widgetAgentIdResult.value,
    name: nameResult.value,
    email: emailResult.value,
    phone: phoneResult.value,
    message: messageResult.value,
  });
}

export function validateWidgetEventBody(input: unknown): ValidationResult<WidgetEventBody> {
  const record = asRecord(input);

  if (!record) {
    return invalid("Request body must be a JSON object.");
  }

  const sessionIdResult = readRequiredString(
    record.sessionId,
    "sessionId",
    MAX_SESSION_ID_LENGTH,
  );
  if (!sessionIdResult.valid) {
    return sessionIdResult;
  }

  const eventTypeResult = readRequiredString(
    record.eventType ?? record.event,
    "eventType",
    MAX_METADATA_VALUE_LENGTH,
  );
  if (!eventTypeResult.valid) {
    return eventTypeResult;
  }

  if (
    !WIDGET_EVENT_TYPES.includes(eventTypeResult.value as WidgetEventType)
  ) {
    return invalid("eventType is not allowed.");
  }

  const pageUrlResult = readOptionalString(
    record.pageUrl,
    "pageUrl",
    MAX_PAGE_URL_LENGTH,
  );
  if (!pageUrlResult.valid) {
    return pageUrlResult;
  }

  const referrerResult = readOptionalString(
    record.referrer,
    "referrer",
    MAX_REFERRER_LENGTH,
  );
  if (!referrerResult.valid) {
    return referrerResult;
  }

  const occurredAtResult = readOptionalString(
    record.occurredAt,
    "occurredAt",
    MAX_OCCURRED_AT_LENGTH,
  );
  if (!occurredAtResult.valid) {
    return occurredAtResult;
  }

  const visibilityStateResult = readOptionalString(
    record.visibilityState,
    "visibilityState",
    MAX_VISIBILITY_STATE_LENGTH,
  );
  if (!visibilityStateResult.valid) {
    return visibilityStateResult;
  }

  const metadataResult = normalizeMetadata(record.metadata, {
    occurredAt: occurredAtResult.value,
    pageUrl: pageUrlResult.value,
    referrer: referrerResult.value,
    visibilityState: visibilityStateResult.value,
  });
  if (!metadataResult.valid) {
    return metadataResult;
  }

  return valid({
    sessionId: sessionIdResult.value,
    eventType: eventTypeResult.value as WidgetEventType,
    metadata: metadataResult.value,
    pageUrl: pageUrlResult.value,
    referrer: referrerResult.value,
  });
}
