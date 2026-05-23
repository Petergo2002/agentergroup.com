import { type NextRequest, NextResponse } from "next/server";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler for third-party providers (e.g. Google).
 *
 * After the user authenticates with the provider, Supabase redirects here
 * with a `code` query parameter. We exchange the code for a session and
 * then redirect the user into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizePostAuthRedirectTo(searchParams.get("next"));
  const origin = request.nextUrl.origin;
  const redirectTo = new URL(next, origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }

    console.error("[Auth Callback] Code exchange error:", error.message);
  } else {
    console.warn("[Auth Callback] No code found in callback URL");
  }

  return NextResponse.redirect(
    new URL("/login?error=Could+not+authenticate+with+provider", origin),
  );
}
