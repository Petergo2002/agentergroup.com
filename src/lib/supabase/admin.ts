import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAdminKey,
  getSupabaseEnv,
  hasSupabaseAdminEnv,
} from "@/lib/env";

export function createAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and restart the Next.js dev server.",
    );
  }

  const { url } = getSupabaseEnv();
  const adminKey = getSupabaseAdminKey();

  return createClient(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
