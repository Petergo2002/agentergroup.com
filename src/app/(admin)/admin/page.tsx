import {
  AdminWorkspaceTable,
} from "@/components/admin/AdminWorkspaceTable";
import { AdminStatCards } from "@/components/admin/AdminStatCards";
import { requireAdminUser } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import {
  resolveAdminWorkspaceSortKey,
  sortAdminWorkspaces,
} from "@/lib/admin/sort";
import { getServerLanguage } from "@/lib/i18n-server";

interface AdminOverviewPageProps {
  searchParams: Promise<{
    sort?: string;
    direction?: string;
  }>;
}

export default async function AdminOverviewPage({
  searchParams,
}: AdminOverviewPageProps) {
  await requireAdminUser();
  const language = await getServerLanguage();

  const params = await searchParams;
  const sortKey = resolveAdminWorkspaceSortKey(params.sort);
  const direction = params.direction === "asc" ? "asc" : "desc";
  const overview = await getAdminOverview();
  const sortedWorkspaces = sortAdminWorkspaces(
    overview.workspaces,
    sortKey,
    direction,
  );

  return (
    <div className="space-y-8 admin-fade-in">
      <header>
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
          {language === "sv" ? "Intern admin" : "Internal admin"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-on-surface">
          {language === "sv" ? "Översikt" : "Overview"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">
          {language === "sv"
            ? "Övergripande insyn i kundkonton, vad de har byggt och hur aktivt plattformen används."
            : "High-level visibility into customer accounts, what they have built, and how actively the platform is being used."}
        </p>
      </header>

      <AdminStatCards summary={overview.summary} language={language} />

      <section id="customers" className="space-y-4">
        <div>
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
            {language === "sv" ? "Workspaces" : "Workspaces"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-on-surface">
            {language === "sv" ? "Kundaktivitet" : "Customer activity"}
          </h2>
        </div>
        <AdminWorkspaceTable
          workspaces={sortedWorkspaces}
          sortKey={sortKey}
          direction={direction}
          basePath="/admin"
          language={language}
        />
      </section>
    </div>
  );
}
