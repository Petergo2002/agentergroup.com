/**
 * Matches standard email addresses (case-insensitive).
 */
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const INTL_PHONE_PATTERN =
  /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{1,4})?/;

const CONTEXTUAL_PHONE_PATTERN =
  /\b(?:phone|telefon|nummer|ring|call|mobil|tel)\s*[:\-]?\s*([\d\s.\-()]{7,20})/i;

const GENERIC_PHONE_PATTERN =
  /(?:^|[^A-Za-z0-9])(\+?\d(?:[\s().-]*\d){6,14})(?![A-Za-z0-9])/;

const STRUCTURED_NAME_PATTERN =
  /\b(?:name|namn)\s*[:\-]\s*([^\n,]+?)(?=(?:\s+(?:email|e-post|mail|phone|telefon)\b)|$)/i;

const INTRO_NAME_PATTERN =
  /\b(?:my name is|i'm|i am|this is|jag heter|mitt namn är)\s+([A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF][A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF' -]{1,79}?)(?=(?:\s+(?:and|och)\s+(?:my|mitt|min|email|e-post|phone|telefon|number|nummer|mobil|tel)\b)|[,.!?;\n]|$)/i;

export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/[.!?;,:\-–—]+$/, "")
    .trim();

  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  if (EMAIL_PATTERN.test(normalized) || /\d/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * Extracts contact details from visitor messages while ignoring assistant text.
 */
export function extractContactFromMessages(
  messages: Array<{ role: string; content: string }>,
): ExtractedContact | null {
  let detectedEmail: string | null = null;
  let detectedPhone: string | null = null;
  let detectedName: string | null = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    const content = message.content;
    if (!content?.trim()) continue;

    if (!detectedEmail) {
      const emailMatch = content.match(EMAIL_PATTERN);
      if (emailMatch) {
        detectedEmail = emailMatch[0].trim().toLowerCase();
      }
    }

    if (!detectedPhone) {
      const intlMatch = content.match(INTL_PHONE_PATTERN);
      if (intlMatch) {
        detectedPhone = normalizePhone(intlMatch[0]);
      } else {
        const contextMatch = content.match(CONTEXTUAL_PHONE_PATTERN);
        if (contextMatch?.[1]) {
          detectedPhone = normalizePhone(contextMatch[1]);
        } else {
          const genericMatch = content.match(GENERIC_PHONE_PATTERN);
          if (genericMatch?.[1]) {
            detectedPhone = normalizePhone(genericMatch[1]);
          }
        }
      }
    }

    if (!detectedName) {
      const structuredMatch = content.match(STRUCTURED_NAME_PATTERN);
      const introMatch = content.match(INTRO_NAME_PATTERN);
      detectedName =
        normalizeName(structuredMatch?.[1]) ??
        normalizeName(introMatch?.[1]);
    }

    if (detectedEmail && detectedPhone && detectedName) {
      break;
    }
  }

  if (!detectedEmail && !detectedPhone) {
    return null;
  }

  return {
    name: detectedName,
    email: detectedEmail,
    phone: detectedPhone,
  };
}
