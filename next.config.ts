import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { getAppSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: process.env.NODE_ENV === "production",
  experimental: {
    // Every authenticated route is dynamic (the root layout reads headers() for
    // the CSP nonce), and `dynamic` defaults to 0 — so returning to a page a
    // visitor just left re-ran the whole auth + workspace chain on the server.
    // Reusing the router cache for 30s makes back-and-forth navigation instant.
    // Signing out is a native form POST to /auth/logout, a full browser
    // navigation, so this cache never outlives a session.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getAppSecurityHeaders({ contentSecurityPolicy: false }),
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // Supabase Storage — covers all buckets and all projects on the same instance
        protocol: "https",
        hostname: "rklntfzmqayziqesjoih.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

/**
 * Source maps are uploaded to Sentry so production stack traces are readable.
 * Without this, browser errors arrive as `a.b is not a function` at
 * chunk-4f2a.js:1:88213, which makes the frontend half of error tracking close
 * to worthless. (Server frames stay readable either way.)
 *
 * Three deliberate safety properties:
 *
 *  - Upload only happens when SENTRY_AUTH_TOKEN is present, so CI and local
 *    builds behave exactly as before.
 *  - errorHandler downgrades plugin failures to a warning. The default is to
 *    throw, which would let a Sentry outage or an expired token break a
 *    production deploy — an unacceptable coupling for a monitoring tool.
 *  - deleteSourcemapsAfterUpload keeps the maps out of the deployed bundle, so
 *    uploading them to Sentry never means publishing our source to the web.
 */
const hasSentryUploadCredentials = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Uploads a wider set of client files so more frames resolve to real source.
  widenClientFileUpload: true,

  sourcemaps: {
    disable: !hasSentryUploadCredentials,
    deleteSourcemapsAfterUpload: true,
  },

  // Monitoring must never be able to fail a deploy.
  errorHandler: (error) => {
    console.warn("[sentry] build plugin warning:", error.message);
  },

  silent: !process.env.CI,
  telemetry: false,
});
