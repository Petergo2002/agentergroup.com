import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseEnv,
  getSupabaseServiceRoleKey,
  hasSupabaseServiceRoleEnv,
} from "@/lib/env";

export function createAdminClient() {
  if (!hasSupabaseServiceRoleEnv()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and restart the Next.js dev server.",
    );
  }

  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
