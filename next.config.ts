import type { NextConfig } from "next";
import { getAppSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
