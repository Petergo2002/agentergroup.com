import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <AdminSidebar />
      <main className="pl-60">
        <div className="mx-auto min-h-screen max-w-[1200px] px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
