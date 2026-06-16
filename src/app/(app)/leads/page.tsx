import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import LeadsPageClient from "@/components/leads/LeadsPageClient";

/**
 * Resolves the authenticated workspace metadata needed by the interactive leads inbox.
 */
async function loadLeadsPageContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  return {
    workspaceId: context.workspace.id,
    workspaceName: context.workspace.name,
  };
}

/**
 * Renders the authenticated leads route with the active workspace context.
 */
export default async function LeadsPage() {
  const context = await loadLeadsPageContext();

  return <LeadsPageClient {...context} />;
}
