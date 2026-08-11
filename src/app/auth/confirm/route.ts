import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { recordLegalAcceptance } from "@/lib/legal-consent";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function legalConsentErrorRedirect(origin: string) {
  return NextResponse.redirect(
    new URL(
      "/login?view=signup&error=We+could+not+record+your+agreement.+Please+request+a+new+signup+link.",
      origin,
    ),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizePostAuthRedirectTo(searchParams.get("next"));

  // Remove the short-lived signed consent token before the browser reaches the page.
  const nextUrl = new URL(next, request.nextUrl.origin);
  const legalConsent = nextUrl.searchParams.get("legalConsent");
  nextUrl.searchParams.delete("legalConsent");
  const redirectTo = new URL(
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    request.nextUrl.origin,
  );

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      if (await recordSignupConsent()) {
        return NextResponse.redirect(redirectTo);
      }
      return legalConsentErrorRedirect(request.nextUrl.origin);
    }
    console.error("[Auth Confirm] Verify OTP Error:", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (await recordSignupConsent()) {
        return NextResponse.redirect(redirectTo);
      }
      return legalConsentErrorRedirect(request.nextUrl.origin);
    }
    console.error("[Auth Confirm] Code Exchange Error:", error.message);
  } else {
    console.warn("[Auth Confirm] No valid token_hash or code found in URL");
  }

  // Redirect to error page if verification fails
  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", request.nextUrl.origin),
  );

  async function recordSignupConsent() {
    if (!legalConsent || nextUrl.pathname !== "/complete-signup") {
      await supabase.auth.signOut();
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await supabase.auth.signOut();
      return false;
    }

    try {
      await recordLegalAcceptance({
        supabase: createAdminClient(),
        userId: user.id,
        token: legalConsent,
      });
      return true;
    } catch (consentError) {
      console.error(
        "[Auth Confirm] Legal consent error:",
        consentError instanceof Error ? consentError.message : consentError,
      );
      await supabase.auth.signOut();
      return false;
    }
  }
}
