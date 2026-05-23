import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
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
 * - /api/billing/webhook
 * - /api/composio/webhook
 * - /api/internal/privacy/retention
 * - /connect/*
 * - /privacy-policy
 * - /data-processing
 * - /subprocessors
 * - /_next/*
 * - /favicon.ico
 * - static asset paths
 *
 * All other matched routes require authentication by default. Add routes to the
 * explicit public lists only when they are intentionally unauthenticated and
 * have their own verification where needed.
 */
const PUBLIC_EXACT_PATHS = [
  "/",
  "/signup",
  "/api/health",
  "/privacy-policy",
  "/data-processing",
  "/subprocessors",
] as const;

const PUBLIC_PATH_PREFIXES = [
  "/api/public",
  "/login",
  "/auth",
  "/api/billing/webhook",
  "/api/composio/webhook",
  "/api/internal/privacy/retention",
  "/connect",
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
  return (
    PUBLIC_EXACT_PATHS.includes(pathname as (typeof PUBLIC_EXACT_PATHS)[number]) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
  );
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

  if (isExplicitPublicPath(pathname)) {
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
    url.searchParams.set(
      "redirectTo",
      sanitizePostAuthRedirectTo(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    return withSecurityHeaders(NextResponse.redirect(url), contentSecurityPolicy);
  }

  return supabaseResponse;
}
