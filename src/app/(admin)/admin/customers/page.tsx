import { AdminWorkspaceTable } from "@/components/admin/AdminWorkspaceTable";
import { requireAdminUser } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import {
  resolveAdminWorkspaceSortKey,
  sortAdminWorkspaces,
} from "@/lib/admin/sort";

interface AdminCustomersPageProps {
  searchParams: Promise<{
    sort?: string;
    direction?: string;
  }>;
}

export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
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
          Customers
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Workspace directory
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
          A clean workspace-level view of who is using the platform and how active they are.
        </p>
      </header>

      <AdminWorkspaceTable
        workspaces={sortedWorkspaces}
        sortKey={sortKey}
        direction={direction}
        basePath="/admin/customers"
      />
    </div>
  );
}
