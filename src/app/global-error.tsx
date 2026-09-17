"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary for failures the route-level error.tsx cannot catch —
 * errors thrown by the root layout itself, and render errors that escape the
 * app segment. Without this, those produced Next's unstyled default page and
 * were never reported.
 *
 * Deliberately self-contained: it replaces the root layout, so it cannot rely
 * on providers (theme, i18n, toasts) that may be exactly what failed. That is
 * why the copy here is not translated — reaching for the i18n provider in the
 * handler for "the provider tree crashed" is how a boundary becomes a loop.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#fafaf9",
          color: "#181818",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0.75rem 0 1.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#667085",
            }}
          >
            Avenro hit an unexpected error. The team has been notified.
          </p>
          {/*
            A real anchor, not next/link, on purpose: this boundary renders when
            the app tree has already crashed, so a client-side router
            navigation cannot be trusted. A full document load is the recovery.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.75rem",
              background: "#181818",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Reload Avenro
          </a>
        </main>
      </body>
    </html>
  );
}
