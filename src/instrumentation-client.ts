import * as Sentry from "@sentry/nextjs";

/**
 * Browser error reporting. Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (clientDsn) {
  // Next's instrumentation docs call for guarding this: a failure here runs
  // before the app is interactive, and must not take other instrumentation
  // (or the page) down with it.
  try {
    Sentry.init({
      dsn: clientDsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0,
      ),

      // Session Replay stays off: it records sessions verbatim, and the
      // sessions here contain other companies' customers' conversations.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      // Explicit rather than the deprecated sendDefaultPii flag, which is
      // removed in v11. These categories each default to *collecting*, so
      // relying on the old flag would have shipped visitor chat message bodies,
      // cookies, and Authorization headers to a third party.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    });
  } catch (error) {
    console.warn("[sentry] client init failed", error);
  }
}

/**
 * Only wire Sentry into App Router navigations when it is actually configured;
 * otherwise this hands Next a Sentry callback to invoke on every transition
 * for no benefit.
 */
export const onRouterTransitionStart = clientDsn
  ? Sentry.captureRouterTransitionStart
  : undefined;
