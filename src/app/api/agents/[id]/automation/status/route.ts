import { NextRequest, NextResponse } from "next/server";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  createComposioTrigger,
  deleteComposioTrigger,
  disableComposioTrigger,
  enableComposioTrigger,
} from "@/lib/composio";
import { hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";
import type { AgentAutomationRecord } from "@/lib/types";

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

  const body = await request.json().catch(() => ({}));
  const action = body.action === "activate" ? "activate" : body.action === "pause" ? "pause" : null;

  if (!action) {
    return NextResponse.json({ error: "Invalid automation status action." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!agent || agent.surface !== "automation") {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const membershipRole = getMembershipRoleForWorkspace(
    context.workspaces,
    agent.workspace_id,
  );

  if (!canEditAgentRecord(agent, user.id, membershipRole)) {
    return NextResponse.json(
      { error: "You do not have permission to change this automation." },
      { status: 403 },
    );
  }

  if (agent.archived_at) {
    return NextResponse.json(
      { error: "Restore the automation before changing its trigger status." },
      { status: 400 },
    );
  }

  const { data: automation, error: automationError } = await supabase
    .from("agent_automations")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (automationError) {
    return NextResponse.json({ error: automationError.message }, { status: 500 });
  }

  if (!automation) {
    return NextResponse.json({ error: "Save the automation before activating it." }, { status: 400 });
  }

  const automationRecord = automation as AgentAutomationRecord;

  if (action === "pause") {
    if (automationRecord.composio_trigger_id) {
      try {
        await disableComposioTrigger(automationRecord.composio_trigger_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to disable Composio trigger.";

        await supabase
          .from("agent_automations")
          .update({ status: "error", last_error: message })
          .eq("id", automationRecord.id);

        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const [automationUpdate, agentUpdate] = await Promise.all([
      supabase
        .from("agent_automations")
        .update({ status: "paused", last_error: null })
        .eq("id", automationRecord.id),
      supabase.from("agents").update({ status: "paused" }).eq("id", agentId),
    ]);

    if (automationUpdate.error) {
      if (automationRecord.composio_trigger_id) {
        await enableComposioTrigger(automationRecord.composio_trigger_id).catch((error) => {
          console.error("Failed to re-enable Composio trigger after pause persistence error", error);
        });
      }

      return NextResponse.json({ error: automationUpdate.error.message }, { status: 500 });
    }

    if (agentUpdate.error) {
      if (automationRecord.composio_trigger_id) {
        await enableComposioTrigger(automationRecord.composio_trigger_id).catch((error) => {
          console.error("Failed to re-enable Composio trigger after pause persistence error", error);
        });
      }

      return NextResponse.json({ error: agentUpdate.error.message }, { status: 500 });
    }

    await createAuditLog(supabase, {
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      actorId: user.id,
      action: "automation.paused",
      summary: "Paused an external trigger binding.",
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, status: "paused" });
  }

  if (!hasComposioEnv()) {
    return NextResponse.json({ error: "COMPOSIO_API_KEY is missing." }, { status: 500 });
  }

  if (!hasComposioWebhookSecret()) {
    return NextResponse.json({ error: "COMPOSIO_WEBHOOK_SECRET is missing." }, { status: 500 });
  }

  if (!automationRecord.connection_id) {
    return NextResponse.json({ error: "Select a Gmail connection before activating." }, { status: 400 });
  }

  const { data: connection } = await supabase
    .from("connections")
    .select("id, external_id, toolkit_data, status, toolkit_slug, workspace_id")
    .eq("id", automationRecord.connection_id)
    .eq("workspace_id", context.workspace.id)
    .eq("toolkit_slug", "gmail")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "Select a connected Gmail account." }, { status: 400 });
  }

  const provisioningUpdate = await supabase
    .from("agent_automations")
    .update({ status: "provisioning", last_error: null })
    .eq("id", automationRecord.id);

  if (provisioningUpdate.error) {
    return NextResponse.json({ error: provisioningUpdate.error.message }, { status: 500 });
  }

  let createdTriggerId: string | null = null;
  let providerActivated = false;

  try {
    let composioTriggerId = automationRecord.composio_trigger_id;

    if (composioTriggerId) {
      await enableComposioTrigger(composioTriggerId);
      providerActivated = true;
    } else {
      const trigger = await createComposioTrigger({
        workspaceId: context.workspace.id,
        connection,
        triggerSlug: automationRecord.trigger_slug,
        triggerConfig: automationRecord.trigger_config,
      });
      composioTriggerId = trigger.triggerId;
      createdTriggerId = composioTriggerId;
      providerActivated = true;
    }

    const [automationUpdate, agentUpdate] = await Promise.all([
      supabase
        .from("agent_automations")
        .update({
          status: "active",
          composio_trigger_id: composioTriggerId,
          last_error: null,
        })
        .eq("id", automationRecord.id),
      supabase.from("agents").update({ status: "active" }).eq("id", agentId),
    ]);

    if (automationUpdate.error) {
      throw automationUpdate.error;
    }

    if (agentUpdate.error) {
      throw agentUpdate.error;
    }

    await createAuditLog(supabase, {
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      actorId: user.id,
      action: "automation.activated",
      summary: "Activated an external trigger binding.",
      metadata: { composioTriggerId },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, status: "active", composioTriggerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate automation.";
    const triggerId = createdTriggerId ?? automationRecord.composio_trigger_id;

    if (providerActivated && triggerId) {
      const cleanup = createdTriggerId
        ? deleteComposioTrigger(triggerId)
        : disableComposioTrigger(triggerId);

      await cleanup.catch((cleanupError) => {
        console.error("Failed to clean up Composio trigger after activation error", cleanupError);
      });
    }

    await Promise.all([
      supabase
        .from("agent_automations")
        .update({ status: "error", last_error: message })
        .eq("id", automationRecord.id),
      supabase.from("agents").update({ status: "paused" }).eq("id", agentId),
    ]);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
