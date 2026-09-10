"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { createLegalConsentToken, recordLegalAcceptance } from "@/lib/legal-consent";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateWorkspaceContextCache } from "@/lib/app/bootstrap";

function getCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    redirectTo: sanitizePostAuthRedirectTo(String(formData.get("redirectTo") ?? "/onboarding")),
  };
}

async function getLoginMessages() {
  const language = await getServerLanguage();
  return (await getMessages(language)).login;
}

function buildLoginRedirectUrl(args: {
  error?: string;
  notice?: string;
  redirectTo?: string;
  view?: "login" | "signup";
}) {
  const params = new URLSearchParams();

  if (args.error) {
    params.set("error", args.error);
  }

  if (args.notice) {
    params.set("notice", args.notice);
  }

  if (args.view === "signup") {
    params.set("view", "signup");
  }

  const redirectTo = sanitizePostAuthRedirectTo(args.redirectTo);
  if (redirectTo !== "/dashboard") {
    params.set("redirectTo", redirectTo);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

function buildCompleteSignupRedirectUrl(args: {
  error?: string;
  legalConsent?: string;
  redirectTo?: string;
}) {
  const params = new URLSearchParams();

  if (args.error) {
    params.set("error", args.error);
  }

  if (args.legalConsent) {
    params.set("legalConsent", args.legalConsent);
  }

  const redirectTo = sanitizePostAuthRedirectTo(args.redirectTo, "/onboarding");
  if (redirectTo !== "/onboarding") {
    params.set("redirectTo", redirectTo);
  }

  const query = params.toString();
  return query ? `/complete-signup?${query}` : "/complete-signup";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const credentials = getCredentials(formData);
  const messages = await getLoginMessages();

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    redirect(
      buildLoginRedirectUrl({
        error: messages.signInError,
        redirectTo: credentials.redirectTo,
      }),
    );
  }

  revalidatePath("/", "layout");
  redirect(credentials.redirectTo);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const legalConsentAccepted = formData.get("legalConsent") === "on";
  const redirectTo = sanitizePostAuthRedirectTo(String(formData.get("redirectTo") ?? "/dashboard"));
  const messages = await getLoginMessages();

  if (!fullName) {
    redirect(buildLoginRedirectUrl({
      error: "Please enter your full name.",
      redirectTo,
      view: "signup",
    }));
  }

  if (!companyName) {
    redirect(buildLoginRedirectUrl({
      error: "Please enter your company name.",
      redirectTo,
      view: "signup",
    }));
  }

  if (!email) {
    redirect(buildLoginRedirectUrl({
      error: "Email is required.",
      redirectTo,
      view: "signup",
    }));
  }

  if (!password || password.length < 6) {
    redirect(buildLoginRedirectUrl({
      error: messages.passwordPlaceholder || "Password must be at least 6 characters.",
      redirectTo,
      view: "signup",
    }));
  }

  if (!legalConsentAccepted) {
    redirect(buildLoginRedirectUrl({
      error: messages.signupConsentRequired,
      redirectTo,
      view: "signup",
    }));
  }

  const legalConsent = createLegalConsentToken("email_signup");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        name: fullName,
        workspace_name: companyName,
      },
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=${encodeURIComponent(
        buildCompleteSignupRedirectUrl({ legalConsent, redirectTo }),
      )}`,
    },
  });

  if (error) {
    redirect(
      buildLoginRedirectUrl({
        error: error.message || messages.createAccountError,
        redirectTo,
        view: "signup",
      }),
    );
  }

  // If a session was returned immediately (email confirmation disabled or auto-confirm)
  if (data?.session?.user) {
    try {
      await recordLegalAcceptance({
        supabase: createAdminClient(),
        userId: data.session.user.id,
        token: legalConsent,
      });
    } catch (consentError) {
      console.error("[Signup] Legal consent error:", consentError);
    }

    revalidatePath("/", "layout");
    redirect(redirectTo);
  }

  revalidatePath("/", "layout");

  redirect(
    buildLoginRedirectUrl({
      notice: messages.confirmEmailNotice,
      redirectTo,
      view: "signup",
    }),
  );
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const redirectTo = sanitizePostAuthRedirectTo(
    String(formData.get("redirectTo") ?? "/onboarding"),
    "/onboarding",
  );
  const messages = await getLoginMessages();

  if (password !== confirmPassword) {
    redirect(buildCompleteSignupRedirectUrl({
      error: messages.passwordsDoNotMatch,
      redirectTo,
    }));
  }

  if (password.length < 6) {
    redirect(buildCompleteSignupRedirectUrl({
      error: messages.passwordPlaceholder,
      redirectTo,
    }));
  }

  // Update password and store profile/workspace metadata
  const { data: updateData, error } = await supabase.auth.updateUser({
    password: password,
    data: {
      full_name: fullName,
      name: fullName,
      workspace_name: companyName,
    },
  });

  if (error) {
    redirect(buildCompleteSignupRedirectUrl({
      error: error.message,
      redirectTo,
    }));
  }

  if (updateData?.user) {
    if (fullName) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", updateData.user.id);
    }
    if (companyName) {
      await supabase
        .from("workspaces")
        .update({ name: companyName })
        .eq("owner_id", updateData.user.id);
    }
    invalidateWorkspaceContextCache(updateData.user.id);
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function forgotPasswordAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const appUrl = getAppUrl();
  const redirectTo = `${appUrl}/auth/callback?next=/complete-signup`;

  if (!email) {
    redirect("/login/forgot-password?error=Please+enter+your+email+address.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect(`/login/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login/forgot-password?success=1");
}
