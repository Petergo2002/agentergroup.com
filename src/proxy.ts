import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * All application routes run through middleware so rendered HTML can receive a
 * per-request CSP nonce. Only authenticated app surfaces are auth-gated.
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
 * Auth-gated route prefixes still live in src/lib/supabase/proxy.ts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\..*).*)",
  ],
};
