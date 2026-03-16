"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    redirectTo: String(formData.get("redirectTo") ?? "/dashboard"),
  };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const credentials = getCredentials(formData);

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(credentials.redirectTo || "/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const credentials = getCredentials(formData);

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");

  if (!data.session) {
    redirect("/login?notice=Check your email to confirm your account.");
  }

  redirect(credentials.redirectTo || "/dashboard");
}
