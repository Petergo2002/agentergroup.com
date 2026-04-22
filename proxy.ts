import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Only authenticated app surfaces run through the auth proxy.
 *
 * Public and never auth-gated here:
 * - /api/public/*
 * - /login
 * - /auth/*
 * - /api/health
 * - /privacy-policy
 * - /_next/*
 * - /favicon.ico
 * - static asset paths
 *
 * Protected and auth-gated:
 * - /dashboard/*
 * - /agents/*
 * - /widgets/*
 * - /api/dashboard/*
 * - /api/agents/*
 * - /api/widgets/*
 * - /connections/*
 * - /settings/*
 *
 * Keep this matcher list aligned with the explicit prefix checks in
 * src/lib/supabase/proxy.ts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/dashboard/:path*",
    "/assistants/:path*",
    "/agents/:path*",
    "/widgets/:path*",
    "/api/dashboard/:path*",
    "/api/agents/:path*",
    "/api/widgets/:path*",
    "/connections/:path*",
    "/settings/:path*",
  ],
};
