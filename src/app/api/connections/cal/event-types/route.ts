import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  getConnectionComposioUserId,
  getEffectiveConnectionStatus,
} from "@/lib/connections";
import { isConnectedAccountMissingError } from "@/lib/composio-errors";
import {
  listCalEventTypes,
  syncConnectedAccountsToDatabase,
  type CalEventType,
} from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionStatus } from "@/lib/types";

interface CalConnectionRow {
  id: string;
  workspace_id: string;
  toolkit_slug: string;
  status: ConnectionStatus;
  external_id: string | null;
  toolkit_data: Record<string, unknown> | null;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() ?? "";

  if (!connectionId) {
    return NextResponse.json(
      { error: "connectionId is required." },
      { status: 400 },
    );
  }

  try {
    await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);
  } catch (error) {
    console.warn("[Cal.com] Failed to sync connected accounts before listing event types:", error);
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

  const connection = data as CalConnectionRow | null;
  if (!connection || connection.toolkit_slug !== "cal") {
    return NextResponse.json(
      { error: "Cal.com connection not found." },
      { status: 404 },
    );
  }

  const connectedAccountId =
    connection.external_id ??
    pickString(connection.toolkit_data?.id) ??
    pickString(connection.toolkit_data?.connectedAccountId);
  const composioUserId = getConnectionComposioUserId(connection);
  const reconnectError =
    "Cal.com must be reconnected in this workspace before event types can be loaded.";

  if (
    getEffectiveConnectionStatus(connection) !== "connected" ||
    !connectedAccountId ||
    !composioUserId
  ) {
    return NextResponse.json({ error: reconnectError }, { status: 400 });
  }

  try {
    const eventTypes = await listCalEventTypes(
      composioUserId,
      connectedAccountId,
    );

    return NextResponse.json({ eventTypes });
  } catch (error) {
    if (isConnectedAccountMissingError(error)) {
      console.warn(
        "[Cal.com] Stored connected account is stale; marking the local row disconnected.",
        {
          connectionId: connection.id,
          connectedAccountId,
          composioUserId,
        },
      );

      const { error: disconnectError } = await supabase
        .from("connections")
        .update({
          status: "disconnected",
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", connection.id)
        .eq("workspace_id", context.workspace.id);

      if (disconnectError) {
        console.warn(
          "[Cal.com] Failed to persist disconnected status after stale connected account detection:",
          disconnectError,
        );
      }

      return NextResponse.json({ eventTypes: [] });
    }

    console.warn("[Cal.com] Could not load event types, falling back to manual input.", {
      connectionId: connection.id,
    });

    return NextResponse.json({ eventTypes: [] });
  }
}
