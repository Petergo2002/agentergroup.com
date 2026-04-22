import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  // Helper to normalize the redirect URL and avoid double slashes
  const redirectTo = new URL(next, request.url);

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
    console.error("[Auth Confirm] Verify OTP Error:", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
    console.error("[Auth Confirm] Code Exchange Error:", error.message);
  } else {
    console.warn("[Auth Confirm] No valid token_hash or code found in URL");
  }

  // Redirect to error page if verification fails
  return NextResponse.redirect(new URL("/login?error=Invalid+or+expired+link", request.url));
}
