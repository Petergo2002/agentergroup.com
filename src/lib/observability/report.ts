import * as SentryNamespace from "@sentry/nextjs";

/**
 * Structured error reporting for operations that must not fail silently.
 *
 * Two transports, deliberately:
 *  - a single-line JSON log, always. This works today with nothing configured,
 *    and is what makes a failure greppable and alertable from platform logs.
 *  - Sentry, when a DSN is configured. This is what turns a failure into a
 *    notification instead of something you find while looking for it.
 *
 * Context is required rather than optional: an error with no operation name is
 * exactly the kind of log line nobody can act on at 2am.
 */

export type ReportSeverity = "warning" | "error" | "fatal";

/**
 * Identifiers safe to attach to a report. Deliberately ids and enums rather
 * than content — enough to find the affected workspace and replay the path,
 * without shipping customer data to a third party.
 */
export interface ReportContext {
  /** Dotted operation name, e.g. "widget.chat.stream" or "billing.webhook". */
  operation: string;
  workspaceId?: string | null;
  agentId?: string | null;
  widgetId?: string | null;
  widgetSessionId?: string | null;
  leadId?: string | null;
  knowledgeSourceId?: string | null;
  requestId?: string | null;
  route?: string | null;
  /** Set for work that runs outside the request lifecycle. */
  jobType?: string | null;
  [key: string]: unknown;
}

/**
 * Anything whose key looks like a credential never reaches a transport.
 * Matched against the key, not the value, so a rotated secret shape cannot
 * sneak through.
 */
const SECRET_KEY_PATTERN =
  /(token|secret|password|passwd|authorization|auth|cookie|apikey|signature|dsn|credential|bearer|privatekey|sessionkey|accesskey)/i;

/**
 * Separators are stripped before matching so snake_case and camelCase spellings
 * of the same field are treated identically — `private_key` and `privateKey`
 * must not have different redaction behaviour.
 */
function normalizeKeyForSecretMatch(key: string) {
  return key.replace(/[_\-\s]/g, "");
}

/** Long free text is almost always customer content; ids and codes are short. */
const MAX_VALUE_LENGTH = 256;
const REDACTED = "[redacted]";

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (SECRET_KEY_PATTERN.test(normalizeKeyForSecretMatch(key))) {
    return REDACTED;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH)}…[truncated]`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= 2) {
    return "[omitted]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) => sanitizeValue(String(index), item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = sanitizeValue(childKey, childValue, depth + 1);
    }
    return out;
  }

  return "[omitted]";
}

export function sanitizeReportContext(
  context: ReportContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    out[key] = sanitizeValue(key, value);
  }
  return out;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const record = error as Error & { code?: unknown; status?: unknown };
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(typeof record.code === "string" || typeof record.code === "number"
        ? { errorCode: record.code }
        : {}),
      ...(typeof record.status === "number" ? { errorStatus: record.status } : {}),
    };
  }

  return { errorName: "NonError", errorMessage: String(error) };
}

function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

interface SentryCaptureApi {
  withScope: (callback: (scope: SentryScopeLike) => void) => void;
  captureException: (exception: unknown) => string;
}

interface SentryScopeLike {
  setLevel: (level: ReportSeverity) => void;
  setTag: (key: string, value: string) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
}

/**
 * Resolves Sentry's capture API across module-resolution differences.
 *
 * Under the Next bundler `@sentry/nextjs` exposes named exports; under plain
 * Node ESM the same specifier resolves to a CJS build whose namespace exposes
 * `init` but leaves `captureException` and `withScope` only on `.default`.
 * Reading through both shapes keeps reporting working in the app, in scripts,
 * and in tests — a mismatch here previously meant every capture silently did
 * nothing while still looking healthy.
 */
function resolveSentryCaptureApi(): SentryCaptureApi | null {
  const candidates: unknown[] = [
    SentryNamespace,
    (SentryNamespace as { default?: unknown }).default,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const api = candidate as Partial<SentryCaptureApi>;
    if (
      typeof api.withScope === "function" &&
      typeof api.captureException === "function"
    ) {
      return api as SentryCaptureApi;
    }
  }

  return null;
}

let hasWarnedAboutMissingSentryApi = false;

/**
 * Reports a failure that a human may need to act on.
 *
 * Never throws: a reporting failure must not take down the operation that was
 * already failing.
 */
export function reportError(
  error: unknown,
  context: ReportContext,
  severity: ReportSeverity = "error",
): void {
  const safeContext = sanitizeReportContext(context);
  const details = describeError(error);

  try {
    console.error(
      JSON.stringify({
        level: severity,
        event: "app_error",
        ...safeContext,
        ...details,
      }),
    );
  } catch {
    // A context that cannot be serialised must not mask the original failure.
    console.error(`app_error ${context.operation} ${details.errorMessage}`);
  }

  if (!isSentryEnabled()) {
    return;
  }

  const sentry = resolveSentryCaptureApi();

  if (!sentry) {
    // Surface this once rather than swallowing it: a DSN is configured, so the
    // operator believes failures are being reported.
    if (!hasWarnedAboutMissingSentryApi) {
      hasWarnedAboutMissingSentryApi = true;
      console.warn(
        "[observability] Sentry DSN is set but its capture API is unavailable; errors are being logged only.",
      );
    }
    return;
  }

  try {
    sentry.withScope((scope) => {
      scope.setLevel(severity);
      scope.setTag("operation", context.operation);
      if (context.jobType) scope.setTag("job_type", String(context.jobType));
      if (context.route) scope.setTag("route", String(context.route));
      if (context.workspaceId) scope.setTag("workspace_id", String(context.workspaceId));
      scope.setContext("avenro", safeContext);
      sentry.captureException(
        error instanceof Error ? error : new Error(details.errorMessage),
      );
    });
  } catch (reportingError) {
    // Never let the reporter break the caller, but never hide it either.
    console.warn("[observability] Sentry capture failed", reportingError);
  }
}

/**
 * Structured-log-only variant.
 *
 * Used where something else already owns delivery to Sentry (currently Next's
 * onRequestError hook, which hands off to Sentry.captureRequestError) and a
 * second captureException would double-report the same failure.
 */
export function reportRequestErrorLog(
  error: unknown,
  context: ReportContext,
): void {
  const safeContext = sanitizeReportContext(context);
  const details = describeError(error);

  try {
    console.error(
      JSON.stringify({
        level: "error",
        event: "app_error",
        ...safeContext,
        ...details,
      }),
    );
  } catch {
    console.error(`app_error ${context.operation} ${details.errorMessage}`);
  }
}

/** Same contract as reportError, for degraded-but-handled conditions. */
export function reportWarning(error: unknown, context: ReportContext): void {
  reportError(error, context, "warning");
}
