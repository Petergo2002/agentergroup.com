import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Public paths that must never be auth-gated here:
 * - /api/public/*
 * - /login
 * - /auth/*
 * - /api/health
 * - /privacy-policy
 * - /_next/*
 * - /favicon.ico
 * - static asset paths
 *
 * Protected paths that require authentication:
 * - /dashboard/*
 * - /agents/*
 * - /widgets/*
 * - /api/dashboard/*
 * - /api/agents/*
 * - /api/widgets/*
 * - /connections/*
 * - /settings/*
 *
 * Any route that is not explicitly protected is allowed through by default so
 * new public routes do not get redirected to /login by accident. Keep this
 * list aligned with proxy.ts.
 */
const PUBLIC_PATH_PREFIXES = [
  "/api/public",
  "/login",
  "/auth",
  "/api/health",
  "/privacy-policy",
] as const;

const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/agents",
  "/widgets",
  "/api/dashboard",
  "/api/agents",
  "/api/widgets",
  "/connections",
  "/settings",
] as const;

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isExplicitPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isExplicitPublicPath(pathname) || !isProtectedPath(pathname)) {
    return NextResponse.next({
      request,
    });
  }

  const { url, publishableKey } = getSupabaseEnv();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
