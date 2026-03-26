import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Ensures the current request is authenticated as an internal admin.
 *
 * Returns the current auth user on success and redirects to /dashboard on any
 * failure without exposing whether the admin route exists.
 */
export async function requireAdminUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/dashboard");
  }

  let adminClient;

  try {
    adminClient = createAdminClient();
  } catch {
    redirect("/dashboard");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("is_admin", true)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  return user;
}
