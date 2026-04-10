import {
  hasInternalAssistantsEnabled,
} from "@/lib/assistants/feature-flags";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listWorkspaceAssistants } from "@/lib/assistants/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AssistantsPageClient from "./AssistantsPageClient";

async function loadAssistantsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

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
