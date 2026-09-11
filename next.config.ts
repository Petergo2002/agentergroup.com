import type { NextConfig } from "next";
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

export default nextConfig;
