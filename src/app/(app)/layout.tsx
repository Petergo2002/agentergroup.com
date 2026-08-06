import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getAppRequestContext } from "@/lib/app/request-context";
import { hasSupabaseEnv } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const { user, context } = await getAppRequestContext();

  if (!user || !context) {
    redirect("/login");
  }

  // Enforce billing onboarding for owners
  const headerList = await headers();
  const fullUrl = headerList.get("x-url") || "";
  const isOwner = context.membership.role === "owner";
  const isOnboardingCompleted = context.workspace.onboarding_completed;
  const isAtOnboardingPage = fullUrl.includes("/onboarding");

  if (isOwner && !isOnboardingCompleted && !isAtOnboardingPage) {
    redirect("/onboarding");
  }

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
