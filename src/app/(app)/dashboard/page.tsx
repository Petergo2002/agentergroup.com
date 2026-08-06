import { getAppRequestContext } from "@/lib/app/request-context";
import { loadDashboardSummaryForContext } from "@/lib/dashboard/summary";
import DashboardPageClient from "./DashboardPageClient";

async function loadDashboardPageData() {
  const { user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

  return loadDashboardSummaryForContext(context);
}

export default async function DashboardPage() {
  const initialData = await loadDashboardPageData();
  return <DashboardPageClient initialData={initialData} />;
}
