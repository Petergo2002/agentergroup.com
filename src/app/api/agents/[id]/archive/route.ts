import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { disableComposioTrigger } from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/runtime/observability";
import type { AgentAutomationRecord } from "@/lib/types";

const ARCHIVE_AGENT_SELECT =
  "id, workspace_id, created_by, surface, archived_at";
const ARCHIVE_AUTOMATION_SELECT =
  "id, workspace_id, agent_id, connection_id, provider, toolkit_slug, trigger_slug, trigger_config, composio_trigger_id, status, last_event_at, last_error, created_at, updated_at";

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

  if (
    context.workspace.product_experience === "milo" &&
    context.workspace.primary_customer_agent_id === agentId
  ) {
    return NextResponse.json(
      { error: "Milo cannot be archived while the Milo experience is active.", code: "milo_primary_agent_protected" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const archived = Boolean(body.archived);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select(ARCHIVE_AGENT_SELECT)
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

  if (archived && agent.surface === "automation") {
    const { data: automation, error: automationError } = await supabase
      .from("agent_automations")
      .select(ARCHIVE_AUTOMATION_SELECT)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (automationError) {
      return NextResponse.json({ error: automationError.message }, { status: 500 });
    }

    const automationRecord = automation as AgentAutomationRecord | null;

    if (automationRecord?.composio_trigger_id) {
      try {
        await disableComposioTrigger(automationRecord.composio_trigger_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to disable provider trigger.";

        await supabase
          .from("agent_automations")
          .update({ status: "error", last_error: message })
          .eq("id", automationRecord.id);

        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (automationRecord) {
      const automationPause = await supabase
        .from("agent_automations")
        .update({ status: "paused", last_error: null })
        .eq("id", automationRecord.id);

      if (automationPause.error) {
        return NextResponse.json({ error: automationPause.error.message }, { status: 500 });
      }
    }
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? user.id : null,
      ...(archived && agent.surface === "automation" ? { status: "paused" } : {}),
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
