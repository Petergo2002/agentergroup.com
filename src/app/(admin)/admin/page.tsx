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
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          Internal admin
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Overview
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
          High-level visibility into customer accounts, what they have built,
          and how actively the platform is being used.
        </p>
      </header>

      <AdminStatCards summary={overview.summary} />

      <section id="customers" className="space-y-4">
        <div>
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Workspaces
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Customer activity
          </h2>
        </div>
        <AdminWorkspaceTable
          workspaces={sortedWorkspaces}
          sortKey={sortKey}
          direction={direction}
          basePath="/admin"
        />
      </section>
    </div>
  );
}
