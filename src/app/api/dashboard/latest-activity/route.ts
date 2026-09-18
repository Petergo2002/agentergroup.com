import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getDashboardLatestActivity } from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/latest-activity?workspaceId=...
 *
 * Feeds the sidebar attention badges.
 *
 * The workspace is named explicitly by the caller rather than inferred from the
 * session. Inferring it put another workspace's counts in the sidebar two ways
 * at once: the response is browser-cached for 15s and the URL used to be
 * identical for every workspace, so switching replayed the previous
 * workspace's payload; and `ensureWorkspaceContext` resolves the *active*
 * workspace from a 30-second cache that a warm instance may not have
 * invalidated yet. A workspace in the URL fixes both, because the browser
 * cache is keyed by URL and the server stops guessing.
 *
 * The id is still checked against the caller's memberships — a parameter the
 * client supplies decides which workspace to read, so it cannot be trusted on
 * its own.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const requestedWorkspaceId = request.nextUrl.searchParams
      .get("workspaceId")
      ?.trim();

    let workspaceId = context.workspace.id;

    if (requestedWorkspaceId) {
      const isMember = context.workspaces.some(
        (entry) => entry.workspace.id === requestedWorkspaceId,
      );

      if (!isMember) {
        return NextResponse.json(
          { error: "Workspace not found." },
          { status: 404 },
        );
      }

      workspaceId = requestedWorkspaceId;
    }

    const admin = createAdminClient();
    const payload = await getDashboardLatestActivity(admin, workspaceId);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load latest dashboard activity.",
      },
      { status: 500 },
    );
  }
}
