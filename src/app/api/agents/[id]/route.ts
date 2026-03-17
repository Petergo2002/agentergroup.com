import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
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
  const confirmationName =
    typeof body.confirmationName === "string" ? body.confirmationName.trim() : "";

  const agentResult = await supabase
    .from("agents")
    .select("id, name, workspace_id, archived_at")
    .eq("id", agentId)
    .maybeSingle();

  if (agentResult.error) {
    return NextResponse.json({ error: agentResult.error.message }, { status: 500 });
  }

  const agent = agentResult.data;

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === agent.workspace_id,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (targetWorkspace.membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can permanently delete an agent." },
      { status: 403 },
    );
  }

  if (!agent.archived_at) {
    return NextResponse.json(
      { error: "Archive the agent before permanently deleting it." },
      { status: 400 },
    );
  }

  if (confirmationName !== agent.name) {
    return NextResponse.json(
      { error: "Confirmation name did not match the agent name." },
      { status: 400 },
    );
  }

  const deleteResult = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("workspace_id", agent.workspace_id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  }

  if (!deleteResult.data) {
    return NextResponse.json(
      {
        error:
          "Agent deletion was blocked. Verify the agent still exists and that delete access is enabled.",
      },
      { status: 500 },
    );
  }

  try {
    await createAuditLog(supabase, {
      workspaceId: agent.workspace_id,
      actorId: user.id,
      action: "agent.deleted",
      summary: `Permanently deleted agent "${agent.name}".`,
      metadata: {
        deletedAgentId: agent.id,
        deletedAgentName: agent.name,
      },
    });
  } catch (error) {
    console.error("Failed to write agent delete audit log", error);
  }

  return NextResponse.json({ ok: true });
}
