import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExpandedWorkspaceInviteRecord } from "@/lib/types";

/** GET /api/invites/incoming — List all pending invites addressed to the current user's email. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Uses the workspace_invites_target_select policy which matches email
  const { data: invites, error } = await supabase
    .from("workspace_invites")
    .select(`
      *,
      workspace:workspaces(name, slug),
      inviter:profiles!workspace_invites_invited_by_fkey(full_name, email, avatar_url)
    `)
    .eq("status", "pending")
    // Filter out expired invites server-side just in case
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format array flattening from PostgREST joins
  const formattedInvites: ExpandedWorkspaceInviteRecord[] = (invites ?? []).map((row: any) => {
    const workspaceData = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    const inviterData = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter;

    return {
      id: row.id,
      workspace_id: row.workspace_id,
      email: row.email,
      role: row.role,
      invited_by: row.invited_by,
      token: row.token,
      status: row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      workspace: {
        name: workspaceData?.name ?? "Unknown Workspace",
        slug: workspaceData?.slug ?? "",
      },
      inviter: {
        full_name: inviterData?.full_name ?? null,
        email: inviterData?.email ?? null,
        avatar_url: inviterData?.avatar_url ?? null,
      },
    };
  });

  return NextResponse.json({ incoming: formattedInvites });
}
