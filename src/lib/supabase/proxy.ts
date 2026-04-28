import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import {
  buildAppContentSecurityPolicy,
  getAppSecurityHeaders,
} from "@/lib/security-headers";

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
  "/onboarding",
  "/dashboard",
  "/assistants",
  "/agents",
  "/widgets",
  "/api/dashboard",
  "/api/agents",
  "/api/widgets",
  "/connections",
  "/settings",
] as const;

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function withSecurityHeaders(response: NextResponse, contentSecurityPolicy: string) {
  getAppSecurityHeaders({ contentSecurityPolicy }).forEach(({ key, value }) => {
    response.headers.set(key, value);
  });

  return response;
}

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

  // We set x-url so layouts can detect the current path for redirect logic
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  const contentSecurityPolicy = buildAppContentSecurityPolicy({ nonce });

  requestHeaders.set("x-url", request.url);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  if (isExplicitPublicPath(pathname) || !isProtectedPath(pathname)) {
    return withSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      contentSecurityPolicy,
    );
  }

  const { url, publishableKey } = getSupabaseEnv();

  let supabaseResponse = withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    contentSecurityPolicy,
  );

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = withSecurityHeaders(
          NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          }),
          contentSecurityPolicy,
        );
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
    return withSecurityHeaders(NextResponse.redirect(url), contentSecurityPolicy);
  }

  return supabaseResponse;
}
