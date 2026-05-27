import { loadDashboardSummary } from "@/lib/dashboard/summary";
import { createClient } from "@/lib/supabase/server";
import DashboardPageClient from "./DashboardPageClient";

async function loadDashboardPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return loadDashboardSummary(supabase as never, user);
}

export default async function DashboardPage() {
  const initialData = await loadDashboardPageData();
  return <DashboardPageClient initialData={initialData} />;
}
