import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import { listDriveImportFiles, syncConnectedAccountsToDatabase } from "@/lib/composio";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const syncedAccounts = await syncConnectedAccountsToDatabase(
    supabase as never,
    context.workspace.id,
    user.id,
  );
  const driveAccount = syncedAccounts.find(
    (account) => account.toolkitSlug === "googledrive" && account.status === "connected",
  );

  if (!driveAccount) {
    return NextResponse.json(
      { error: "Google Drive must be connected before you can import files." },
      { status: 400 },
    );
  }

  const search = request.nextUrl.searchParams.get("search") ?? "";
  const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;
  const composioUserId = buildWorkspaceComposioUserId(
    context.workspace.id,
    user.id,
  );

  try {
    const result = await listDriveImportFiles(
      composioUserId,
      search,
      pageToken,
    );

    return NextResponse.json({
      files: result.files,
      nextPageToken: result.nextPageToken,
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
