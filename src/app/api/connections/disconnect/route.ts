import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getEffectiveConnectionStatus } from "@/lib/connections";
import { deleteConnectedAccount } from "@/lib/composio";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionStatus } from "@/lib/types";

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

  try {
    if (
      getEffectiveConnectionStatus(connection) === "connected" &&
      connection.external_id
    ) {
      await deleteConnectedAccount(connection.external_id);
    }
  } catch (error) {
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

  const { error: deleteError } = await supabase
    .from("connections")
    .delete()
    .eq("id", connection.id)
    .eq("workspace_id", context.workspace.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
