import { type NextRequest, NextResponse } from "next/server";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { recordLegalAcceptance } from "@/lib/legal-consent";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function legalConsentErrorRedirect(origin: string) {
  return NextResponse.redirect(
    new URL(
      "/login?view=signup&error=We+could+not+record+your+agreement.+Please+try+again.",
      origin,
    ),
  );
}

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
  const legalConsent = searchParams.get("legalConsent");
  const next = sanitizePostAuthRedirectTo(searchParams.get("next"));
  const origin = request.nextUrl.origin;
  const redirectTo = new URL(next, origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (legalConsent) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          await supabase.auth.signOut();
          return legalConsentErrorRedirect(origin);
        }

        try {
          await recordLegalAcceptance({
            supabase: createAdminClient(),
            userId: user.id,
            token: legalConsent,
          });
        } catch (consentError) {
          console.error(
            "[Auth Callback] Legal consent error:",
            consentError instanceof Error ? consentError.message : consentError,
          );
          await supabase.auth.signOut();
          return legalConsentErrorRedirect(origin);
        }
      }

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
