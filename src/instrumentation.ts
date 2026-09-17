import type { Instrumentation } from "next";
import type { DataCollection } from "@sentry/core";

/**
 * Server and edge observability bootstrap. Inert until SENTRY_DSN is set, so
 * the application builds and runs identically with no Sentry project.
 */

/**
 * What Sentry is allowed to collect.
 *
 * Set explicitly rather than via the deprecated sendDefaultPii flag (removed in
 * v11). Each of these categories defaults to *collecting*, so leaning on the old
 * flag would have shipped request bodies — which on the widget chat route are
 * the visitor's actual messages — plus cookies and Authorization headers to a
 * third party. Identifiers attached through reportError() are enough to debug.
 */
const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  // An empty array disables body collection entirely.
  httpBodies: [],
  urlQueryParams: false,
};

export async function register() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return;
  }

  const runtime = process.env.NEXT_RUNTIME;

  if (runtime !== "nodejs" && runtime !== "edge") {
    return;
  }

  // Guarded so a monitoring failure cannot stop the server from starting.
  try {
    const Sentry = await import("@sentry/nextjs");

    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Errors are the goal; tracing is opt-in so it cannot quietly become a
      // per-request cost.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      dataCollection: SENTRY_DATA_COLLECTION,
    });
  } catch (error) {
    console.warn("[sentry] server init failed", error);
  }
}

/**
 * Catches server errors Next surfaces itself — thrown Server Actions, route
 * handler exceptions, and Server Component render failures.
 *
 * Sentry's own captureRequestError is used for the Sentry side because it
 * attaches request metadata and trace linkage that a plain captureException
 * does not. The structured log line is emitted alongside it so these failures
 * stay greppable in platform logs even with no DSN configured.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const { reportRequestErrorLog } = await import("@/lib/observability/report");

  reportRequestErrorLog(err, {
    operation: "next.request",
    route: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  }
};
