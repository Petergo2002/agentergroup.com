import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { isConnectedAccountMissingError } from "@/lib/composio-errors";
import {
  deleteConnectedAccount,
  disableComposioTrigger,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";
import type { AgentAutomationRecord, ConnectionStatus } from "@/lib/types";

interface DisconnectConnectionRow {
  id: string;
  workspace_id: string;
  toolkit_slug: string;
  status: ConnectionStatus;
  external_id: string | null;
  toolkit_data: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const connectionId = String(body.connectionId ?? "").trim();

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  try {
    await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);
  } catch (error) {
    console.warn("[Connections] Failed to sync connected accounts before disconnect:", error);
  }

  const { data, error } = await supabase
    .from("connections")
    .select("id, workspace_id, toolkit_slug, status, external_id, toolkit_data")
    .eq("id", connectionId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const connection = data as DisconnectConnectionRow | null;
  if (!connection) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }

  const { data: automations, error: automationsError } = await supabase
    .from("agent_automations")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .eq("connection_id", connection.id)
    .in("status", ["active", "provisioning"]);

  if (automationsError) {
    return NextResponse.json({ error: automationsError.message }, { status: 500 });
  }

  const automationRows = (automations ?? []) as AgentAutomationRecord[];

  for (const automation of automationRows) {
    if (automation.composio_trigger_id) {
      try {
        await disableComposioTrigger(automation.composio_trigger_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to disable provider trigger.";

        await supabase
          .from("agent_automations")
          .update({ status: "error", last_error: message })
          .eq("id", automation.id);

        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  try {
    if (
      getEffectiveConnectionStatus(connection) === "connected" &&
      connection.external_id
    ) {
      await deleteConnectedAccount(connection.external_id);
    }
  } catch (error) {
    if (!isConnectedAccountMissingError(error)) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to disconnect the external account.",
        },
        { status: 500 },
      );
    }

    console.warn(
      "[Connections] External account was already missing during disconnect; deleting the local row only.",
      {
        connectionId: connection.id,
        externalId: connection.external_id,
      },
    );
  }

  const { error: deleteError } = await supabase
    .from("connections")
    .delete()
    .eq("id", connection.id)
    .eq("workspace_id", context.workspace.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (automationRows.length > 0) {
    const automationIds = automationRows.map((automation) => automation.id);
    const agentIds = automationRows.map((automation) => automation.agent_id);
    const message = "Connected account was disconnected.";

    const [automationUpdate, agentUpdate] = await Promise.all([
      supabase
        .from("agent_automations")
        .update({ status: "error", last_error: message, connection_id: null })
        .in("id", automationIds),
      supabase.from("agents").update({ status: "paused" }).in("id", agentIds),
    ]);

    if (automationUpdate.error) {
      return NextResponse.json({ error: automationUpdate.error.message }, { status: 500 });
    }

    if (agentUpdate.error) {
      return NextResponse.json({ error: agentUpdate.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
