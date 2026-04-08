import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  getEffectiveConnectionStatus,
  isConnectionScopedToExpectedComposioUser,
} from "@/lib/connections";
import { listDriveImportFiles, syncConnectedAccountsToDatabase } from "@/lib/composio";
import {
  getDriveConnectedAccountId,
  getDriveComposioUserId,
  resolveDriveConnection,
} from "@/lib/drive-connections";
import type { ConnectionRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  await syncConnectedAccountsToDatabase(
    supabase as never,
    context.workspace.id,
    user.id,
  );

  const search = request.nextUrl.searchParams.get("search") ?? "";
  const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;
  const connectionId = request.nextUrl.searchParams.get("connectionId") ?? "";

  const { data, error } = await supabase
    .from("connections")
    .select("id, workspace_id, toolkit_slug, status, external_id, toolkit_data")
    .eq("workspace_id", context.workspace.id)
    .eq("toolkit_slug", "googledrive")
    .order("account_label", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const driveConnections = ((data ?? []) as ConnectionRecord[])
    .filter((connection) => isConnectionScopedToExpectedComposioUser(connection))
    .filter((connection) => getEffectiveConnectionStatus(connection) === "connected");

  try {
    const driveConnection = resolveDriveConnection(driveConnections, connectionId);
    const connectedAccountId = getDriveConnectedAccountId(driveConnection);
    const composioUserId = getDriveComposioUserId(driveConnection);

    if (!connectedAccountId || !composioUserId) {
      throw new Error(
        "Google Drive must be reconnected in this workspace before files can be loaded.",
      );
    }

    const result = await listDriveImportFiles(
      composioUserId,
      search,
      pageToken,
      connectedAccountId,
    );

    return NextResponse.json({
      files: result.files,
      nextPageToken: result.nextPageToken,
      selectedConnectionId: driveConnection.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load Google Drive files.",
      },
      { status: 500 },
    );
  }
}
