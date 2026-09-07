import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { deleteComposioTrigger } from "@/lib/composio";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";
import type { AgentAutomationRecord } from "@/lib/types";
import { WorkspaceAccessError, assertOwnedWorkspaceResource } from "@/lib/workspace-security";

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
  if (
    context.workspace.product_experience === "milo" &&
    context.workspace.primary_customer_agent_id === agentId
  ) {
    return NextResponse.json(
      { error: "Milo cannot be deleted while the Milo experience is active.", code: "milo_primary_agent_protected" },
      { status: 409 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const confirmationName =
    typeof body.confirmationName === "string" ? body.confirmationName.trim() : "";

  const agentResult = await supabase
    .from("agents")
    .select("id, name, workspace_id, archived_at, surface")
    .eq("id", agentId)
    .maybeSingle();

  if (agentResult.error) {
    return NextResponse.json({ error: agentResult.error.message }, { status: 500 });
  }

  const agent = agentResult.data;

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  try {
    assertOwnedWorkspaceResource(
      agent,
      context.workspace.id,
      "You do not have access to delete this agent.",
    );
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === agent.workspace_id,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent, targetWorkspace.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
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

  if (agent.surface === "automation") {
    const { data: automation, error: automationError } = await supabase
      .from("agent_automations")
      .select("*")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (automationError) {
      return NextResponse.json({ error: automationError.message }, { status: 500 });
    }

    const automationRecord = automation as AgentAutomationRecord | null;

    if (automationRecord?.composio_trigger_id) {
      try {
        await deleteComposioTrigger(automationRecord.composio_trigger_id);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete provider trigger.",
          },
          { status: 500 },
        );
      }
    }
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
