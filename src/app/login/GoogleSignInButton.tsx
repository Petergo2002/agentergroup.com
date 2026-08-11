"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  /** Localized button label */
  label: string;
  /** Post-login redirect path */
  redirectTo: string;
  /** Require the signup consent checkbox before creating an account. */
  requireLegalConsent?: boolean;
  /** Localized validation message for missing consent. */
  consentRequiredMessage?: string;
}

/**
 * Client-side "Continue with Google" button.
 *
 * Initiates the Supabase OAuth flow which redirects through Google
 * and back to /auth/callback with an authorization code.
 */
export function GoogleSignInButton({
  label,
  redirectTo,
  requireLegalConsent = false,
  consentRequiredMessage = "You must accept the legal terms to create an account.",
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [consentError, setConsentError] = useState("");

  async function handleGoogleSignIn() {
    let legalConsent = "";

    if (requireLegalConsent) {
      const checkbox = document.getElementById("legalConsent") as HTMLInputElement | null;
      if (!checkbox?.checked) {
        setConsentError(consentRequiredMessage);
        checkbox?.focus();
        return;
      }
    }

    setConsentError("");
    setIsLoading(true);

    if (requireLegalConsent) {
      try {
        const response = await fetch("/auth/legal-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted: true, method: "google_oauth" }),
        });
        const payload = (await response.json()) as { token?: string; error?: string };

        if (!response.ok || !payload.token) {
          throw new Error(payload.error || consentRequiredMessage);
        }

        legalConsent = payload.token;
      } catch (error) {
        setConsentError(
          error instanceof Error ? error.message : "Could not confirm your agreement.",
        );
        setIsLoading(false);
        return;
      }
    }

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", redirectTo);
    if (legalConsent) {
      callbackUrl.searchParams.set("legalConsent", legalConsent);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      const params = new URLSearchParams({
        error: "Could not start Google sign-in. Please try again.",
        redirectTo,
      });
      router.replace(`/login?${params.toString()}`);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="google-sign-in-btn"
        aria-busy={isLoading}
        aria-describedby={consentError ? "googleConsentError" : undefined}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {/* Official Google "G" logo — inline SVG for zero external dependencies */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 48 48"
          aria-hidden="true"
          className={isLoading ? "hidden" : undefined}
        >
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        <span>{isLoading ? "Opening Google..." : label}</span>
      </button>
      {consentError ? (
        <p id="googleConsentError" role="alert" className="text-[12px] font-medium text-red-600">
          {consentError}
        </p>
      ) : null}
    </div>
  );
}
