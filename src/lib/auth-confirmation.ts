export function resolveAuthConfirmationDestination(
  safeNext: string,
  origin: string,
) {
  const nextUrl = new URL(safeNext, origin);
  const legalConsent = nextUrl.searchParams.get("legalConsent");
  const isEmailSignupConfirmation =
    Boolean(legalConsent) &&
    (nextUrl.pathname === "/onboarding" ||
      nextUrl.pathname === "/complete-signup");

  // Never forward the short-lived consent capability into a rendered page or
  // leave it in browser history.
  nextUrl.searchParams.delete("legalConsent");

  if (isEmailSignupConfirmation) {
    // Current signups already collected their password and profile details.
    // Canonicalizing the legacy route also repairs confirmation emails that
    // were issued before this flow was corrected.
    nextUrl.pathname = "/onboarding";
    nextUrl.search = "";
    nextUrl.hash = "";
  }

  return {
    redirectTo: nextUrl,
    legalConsent,
    isEmailSignupConfirmation,
  };
}
