import { getAppRequestContext } from "@/lib/app/request-context";
import LeadsPageClient from "@/components/leads/LeadsPageClient";

/**
 * Resolves the authenticated workspace metadata needed by the interactive leads inbox.
 */
async function loadLeadsPageContext() {
  const { user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

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
