import {
  hasInternalAssistantsEnabled,
} from "@/lib/assistants/feature-flags";
import { getAppRequestContext } from "@/lib/app/request-context";
import { listWorkspaceAssistants } from "@/lib/assistants/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AssistantsPageClient from "./AssistantsPageClient";

async function loadAssistantsPageData() {
  const { user, context } = await getAppRequestContext();

  if (!user || !context) {
    throw new Error("Unauthorized");
  }

  if (!hasInternalAssistantsEnabled(context.workspace)) {
    return [];
  }

  const admin = createAdminClient();
  return listWorkspaceAssistants(admin as never, {
    workspaceId: context.workspace.id,
    actorUserId: user.id,
    membershipRole: context.membership.role,
  });
}

export default async function AssistantsPage() {
  const initialAssistants = await loadAssistantsPageData();
  return <AssistantsPageClient initialAssistants={initialAssistants} />;
}
