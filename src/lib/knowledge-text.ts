export const MAX_KNOWLEDGE_TEXT_SOURCE_BYTES = 1024 * 1024;
export const MAX_KNOWLEDGE_TEXT_REQUEST_BYTES =
  MAX_KNOWLEDGE_TEXT_SOURCE_BYTES * 2 + 64 * 1024;

export type KnowledgeTextValidationResult =
  | {
      valid: true;
      text: string;
      sizeBytes: number;
    }
  | {
      valid: false;
      code: "invalid_type" | "empty" | "too_large";
      error: string;
    };

/** Validate raw knowledge text using UTF-8 bytes, matching Postgres octet_length. */
export function validateKnowledgeText(
  value: unknown,
): KnowledgeTextValidationResult {
  if (typeof value !== "string") {
    return {
      valid: false,
      code: "invalid_type",
      error: "rawText must be a string.",
    };
  }

  if (!value.trim()) {
    return {
      valid: false,
      code: "empty",
      error: "rawText must not be empty.",
    };
  }

  const sizeBytes = new TextEncoder().encode(value).byteLength;
  if (sizeBytes > MAX_KNOWLEDGE_TEXT_SOURCE_BYTES) {
    return {
      valid: false,
      code: "too_large",
      error: "Text knowledge sources are limited to 1MB each.",
    };
  }

  return {
    valid: true,
    text: value,
    sizeBytes,
  };
}
