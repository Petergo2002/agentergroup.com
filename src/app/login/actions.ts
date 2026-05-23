"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";

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
}) {
  const params = new URLSearchParams();

  if (args.error) {
    params.set("error", args.error);
  }

  if (args.notice) {
    params.set("notice", args.notice);
  }

  const redirectTo = sanitizePostAuthRedirectTo(args.redirectTo);
  if (redirectTo !== "/dashboard") {
    params.set("redirectTo", redirectTo);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
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
  const email = String(formData.get("email") ?? "").trim();
  const redirectTo = sanitizePostAuthRedirectTo(String(formData.get("redirectTo") ?? "/dashboard"));
  const messages = await getLoginMessages();

  if (!email) {
    redirect(buildLoginRedirectUrl({ error: "Email is required.", redirectTo }));
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=/complete-signup`,
    },
  });

  if (error) {
    redirect(
      buildLoginRedirectUrl({
        error: messages.createAccountError,
        redirectTo,
      }),
    );
  }

  revalidatePath("/", "layout");

  redirect(
    buildLoginRedirectUrl({
      notice: messages.confirmEmailNotice,
      redirectTo,
    }),
  );
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const messages = await getLoginMessages();

  if (password !== confirmPassword) {
    redirect(`/complete-signup?error=${encodeURIComponent(messages.passwordsDoNotMatch)}`);
  }

  if (password.length < 6) {
    redirect(`/complete-signup?error=${encodeURIComponent(messages.passwordPlaceholder)}`);
  }

  // Update password and store profile/workspace metadata
  const { error } = await supabase.auth.updateUser({
    password: password,
    data: {
      full_name: fullName,
      workspace_name: companyName,
    },
  });

  if (error) {
    redirect(`/complete-signup?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
