"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizeRedirectTo } from "@/lib/auth-redirect";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

function getCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    redirectTo: sanitizeRedirectTo(String(formData.get("redirectTo") ?? "/onboarding")),
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

  const redirectTo = sanitizeRedirectTo(args.redirectTo);
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
  const credentials = getCredentials(formData);
  const messages = await getLoginMessages();

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/onboarding`,
    },
  });

  if (error) {
    redirect(
      buildLoginRedirectUrl({
        error: messages.createAccountError,
        redirectTo: credentials.redirectTo,
      }),
    );
  }

  revalidatePath("/", "layout");

  if (!data.session) {
    redirect(
      buildLoginRedirectUrl({
        notice: messages.confirmEmailNotice,
        redirectTo: credentials.redirectTo,
      }),
    );
  }

  redirect(credentials.redirectTo);
}
