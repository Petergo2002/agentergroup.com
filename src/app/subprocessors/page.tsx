import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SubprocessorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/settings/subprocessors" : "/login");
}
