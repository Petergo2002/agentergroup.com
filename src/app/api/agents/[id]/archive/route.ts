import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/runtime/observability";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const body = await request.json().catch(() => ({}));
  const archived = Boolean(body.archived);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  const membershipRole = getMembershipRoleForWorkspace(
    context.workspaces,
    agent.workspace_id,
  );

  if (!canEditAgentRecord(agent, user.id, membershipRole)) {
    return NextResponse.json(
      { error: "You do not have permission to change this agent." },
      { status: 403 },
    );
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? user.id : null,
    })
    .eq("id", agentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await createAuditLog(supabase, {
    workspaceId: agent.workspace_id,
    agentId: agent.id,
    actorId: user.id,
    action: archived ? "agent.archived" : "agent.restored",
    summary: archived ? "Archived an agent." : "Restored an archived agent.",
  });

  return NextResponse.json({ ok: true });
}
