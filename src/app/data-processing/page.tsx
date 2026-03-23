import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DataProcessingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/settings/data-processing" : "/login");
}
