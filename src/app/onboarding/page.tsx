import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import OnboardingContent from "./OnboardingContent";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  // If onboarding is already completed, go to dashboard
  if (context.workspace.onboarding_completed) {
    redirect("/dashboard");
  }

  // Only owners should see this page. If someone else gets here (unlikely but possible),
  // just send them to dashboard.
  if (context.membership.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <OnboardingContent
      workspaceId={context.workspace.id}
      workspaceName={context.workspace.name}
      currentPlan={context.subscription?.plan_tier || "free"}
    />
  );
}
