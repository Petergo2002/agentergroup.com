import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listGoogleCalendars, syncConnectedAccountsToDatabase } from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";

interface GoogleCalendarConnectionRow {
  id: string;
  workspace_id: string;
  toolkit_slug: string;
  status: string;
  external_id: string | null;
  toolkit_data: Record<string, unknown> | null;
  created_by: string;
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
    .select("id, workspace_id, toolkit_slug, status, external_id, toolkit_data, created_by")
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

  if (connection.status !== "connected" || !connectedAccountId) {
    return NextResponse.json(
      { error: "Google Calendar must be connected before calendars can be loaded." },
      { status: 400 },
    );
  }

  try {
    const calendars = await listGoogleCalendars(
      connection.created_by,
      connectedAccountId,
    );

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error("[Google Calendar] Failed to load calendars:", {
      connectionId: connection.id,
      connectedAccountId,
      createdBy: connection.created_by,
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
