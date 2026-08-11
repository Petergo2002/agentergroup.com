import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-05-23",
  privacy: "2026-03-23",
} as const;

export type LegalAcceptanceMethod = "email_signup" | "google_oauth";

interface LegalConsentPayload {
  version: 1;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  method: LegalAcceptanceMethod;
  nonce: string;
}

interface LegalAcceptanceClient {
  from: (relation: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{
      error: { code?: string; message: string } | null;
    }>;
  };
}

const LEGAL_CONSENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEGAL_CONSENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

function getLegalConsentSecret() {
  const secret =
    process.env.LEGAL_CONSENT_SECRET?.trim() ||
    process.env.RATE_LIMIT_SECRET?.trim() ||
    process.env.WIDGET_ACCESS_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local-legal-consent-secret";
  }

  throw new Error(
    "LEGAL_CONSENT_SECRET is missing. Set LEGAL_CONSENT_SECRET, RATE_LIMIT_SECRET, or WIDGET_ACCESS_SECRET in production.",
  );
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getLegalConsentSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function isLegalAcceptanceMethod(value: unknown): value is LegalAcceptanceMethod {
  return value === "email_signup" || value === "google_oauth";
}

export function createLegalConsentToken(
  method: LegalAcceptanceMethod,
  now = new Date(),
) {
  const payload: LegalConsentPayload = {
    version: 1,
    termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
    privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
    acceptedAt: now.toISOString(),
    method,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyLegalConsentToken(
  token: string,
  now = new Date(),
): LegalConsentPayload | null {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) {
    return null;
  }

  const expectedSignature = Buffer.from(signPayload(encodedPayload), "base64url");
  const providedSignature = Buffer.from(encodedSignature, "base64url");
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<LegalConsentPayload>;
    const acceptedAtMs = Date.parse(payload.acceptedAt ?? "");
    const ageMs = now.getTime() - acceptedAtMs;

    if (
      payload.version !== 1 ||
      payload.termsVersion !== LEGAL_DOCUMENT_VERSIONS.terms ||
      payload.privacyVersion !== LEGAL_DOCUMENT_VERSIONS.privacy ||
      !isLegalAcceptanceMethod(payload.method) ||
      typeof payload.nonce !== "string" ||
      !payload.nonce ||
      !Number.isFinite(acceptedAtMs) ||
      ageMs < -LEGAL_CONSENT_CLOCK_SKEW_MS ||
      ageMs > LEGAL_CONSENT_MAX_AGE_MS
    ) {
      return null;
    }

    return payload as LegalConsentPayload;
  } catch {
    return null;
  }
}

export async function recordLegalAcceptance(args: {
  supabase: LegalAcceptanceClient;
  userId: string;
  token: string;
}) {
  const consent = verifyLegalConsentToken(args.token);
  if (!consent) {
    throw new Error("Legal consent is invalid or expired.");
  }

  const { error } = await args.supabase.from("user_legal_acceptances").insert({
    user_id: args.userId,
    terms_version: consent.termsVersion,
    privacy_version: consent.privacyVersion,
    accepted_at: consent.acceptedAt,
    acceptance_method: consent.method,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  return consent;
}
