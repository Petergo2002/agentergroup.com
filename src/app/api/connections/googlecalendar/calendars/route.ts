import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  getConnectionComposioUserId,
  getEffectiveConnectionStatus,
} from "@/lib/connections";
import { isConnectedAccountMissingError } from "@/lib/composio-errors";
import {
  listGoogleCalendars,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionStatus } from "@/lib/types";

interface GoogleCalendarConnectionRow {
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
    console.warn("[Google Calendar] Failed to sync connected accounts before listing calendars:", error);
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

  const connection = data as GoogleCalendarConnectionRow | null;
  if (!connection || connection.toolkit_slug !== "googlecalendar") {
    return NextResponse.json(
      { error: "Google Calendar connection not found." },
      { status: 404 },
    );
  }

  const connectedAccountId =
    connection.external_id ??
    pickString(connection.toolkit_data?.id) ??
    pickString(connection.toolkit_data?.connectedAccountId);
  const composioUserId = getConnectionComposioUserId(connection);
  const reconnectError =
    "Google Calendar must be reconnected in this workspace before calendars can be loaded.";

  if (
    getEffectiveConnectionStatus(connection) !== "connected" ||
    !connectedAccountId ||
    !composioUserId
  ) {
    return NextResponse.json({ error: reconnectError }, { status: 400 });
  }

  try {
    const calendars = await listGoogleCalendars(
      composioUserId,
      connectedAccountId,
    );

    return NextResponse.json({ calendars });
  } catch (error) {
    if (isConnectedAccountMissingError(error)) {
      console.warn(
        "[Google Calendar] Stored connected account is stale; marking the local row disconnected.",
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
          "[Google Calendar] Failed to persist disconnected status after stale connected account detection:",
          disconnectError,
        );
      }

      return NextResponse.json({ error: reconnectError }, { status: 400 });
    }

    console.error("[Google Calendar] Failed to load calendars:", {
      connectionId: connection.id,
      connectedAccountId,
      composioUserId,
      error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Google Calendars.",
      },
      { status: 500 },
    );
  }
}
