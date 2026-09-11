import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy-policy", "/terms-of-service"],
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/complete-signup",
        "/verify-email",
        "/connect",
        "/dashboard",
        "/data-processing",
        "/invite",
        "/login",
        "/onboarding",
        "/signup",
        "/agents",
        "/analytics",
        "/assistants",
        "/connections",
        "/knowledge",
        "/leads",
        "/milo",
        "/questions",
        "/settings",
        "/subprocessors",
        "/website-chat",
        "/widgets",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
