import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  return (
    <AppShell
      context={context}
      user={{
        id: user.id,
        email: user.email ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
