import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";

const STATUS_AGENT_SELECT =
  "id, workspace_id, created_by, surface, status, published_version_id, archived_at";

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
  const status = body.status === "active" ? "active" : body.status === "paused" ? "paused" : null;

  if (!status) {
    return NextResponse.json({ error: "Invalid agent status." }, { status: 400 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select(STATUS_AGENT_SELECT)
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

  if (agent.archived_at) {
    return NextResponse.json(
      { error: "Restore the agent before changing its status." },
      { status: 400 },
    );
  }

  if (agent.surface === "automation") {
    return NextResponse.json(
      { error: "Use automation trigger controls to activate or pause this agent." },
      { status: 400 },
    );
  }

  if (
    status === "active" &&
    agent.surface === "widget" &&
    !agent.published_version_id
  ) {
    return NextResponse.json(
      { error: "Publish the agent before turning it on." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update({ status })
    .eq("id", agentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await createAuditLog(supabase, {
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      actorId: user.id,
      action: status === "active" ? "agent.activated" : "agent.paused",
      summary: status === "active" ? "Turned an agent on." : "Turned an agent off.",
    });
  } catch (error) {
    console.error("Failed to write agent status audit log", error);
  }

  return NextResponse.json({ ok: true, status });
}
