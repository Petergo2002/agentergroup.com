import { redirect } from "next/navigation";
import { hasInternalAssistantsEnabled } from "@/lib/assistants/feature-flags";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export default async function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  if (!hasInternalAssistantsEnabled(context.workspace)) {
    redirect("/dashboard");
  }

  return children;
}
