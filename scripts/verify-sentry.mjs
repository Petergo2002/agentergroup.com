#!/usr/bin/env node
/**
 * Proves the server-side error path actually reaches Sentry.
 *
 * This is the half that matters most: every background job Avenro runs
 * (lead capture, lead summaries, flywheel, knowledge processing, Stripe
 * webhooks) reports through the same server transport this exercises.
 *
 * Usage:
 *   SENTRY_DSN="https://...@o0.ingest.sentry.io/0" node scripts/verify-sentry.mjs
 *
 * A DSN is a public identifier — it ships in the browser bundle — so it is not
 * a secret. SENTRY_AUTH_TOKEN, used for source-map upload, is.
 */

const dsn = process.env.SENTRY_DSN;

if (!dsn) {
  console.error(
    "SENTRY_DSN is not set.\n" +
      'Run: SENTRY_DSN="<your dsn>" node scripts/verify-sentry.mjs',
  );
  process.exit(1);
}

// Must be the same module reportError() captures through, resolved the same
// defensive way: under plain Node this specifier yields a CJS build whose
// namespace carries `init` but keeps `flush`/`captureException` on `.default`.
const SentryModule = await import("@sentry/nextjs");
const Sentry = typeof SentryModule.flush === "function"
  ? SentryModule
  : SentryModule.default;

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV ?? "local-verification",
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

const { reportError } = await import("../src/lib/observability/report.ts");

// Deliberately shaped like a real background failure, including a
// credential-shaped field, so the redaction path is exercised too.
reportError(new Error("Avenro Sentry verification — safe to resolve"), {
  operation: "verification.sentry_smoke_test",
  jobType: "manual",
  workspaceId: "verification-workspace",
  widgetSessionId: "verification-session",
  accessToken: "this-value-must-not-appear-in-sentry",
});

const delivered = await Sentry.flush(5000);

if (!delivered) {
  console.error(
    "\nSentry did not confirm delivery within 5s.\n" +
      "Check the DSN, and that outbound HTTPS to ingest.sentry.io is allowed.",
  );
  process.exit(1);
}

console.log(
  "\nDelivered. Open Sentry → Issues and look for:\n" +
    '  "Avenro Sentry verification — safe to resolve"\n\n' +
    "Confirm on the issue:\n" +
    "  • tag  operation = verification.sentry_smoke_test\n" +
    "  • tag  workspace_id = verification-workspace\n" +
    '  • context "avenro" shows accessToken = "[redacted]"  <- redaction working\n',
);
