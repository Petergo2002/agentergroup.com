import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceMemberWithProfile } from "@/lib/types";

/** GET /api/workspaces/[id]/members — List workspace members with profile info. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === workspaceId,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("id, workspace_id, user_id, role, created_at, profile:profiles(id, email, full_name, avatar_url)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members: WorkspaceMemberWithProfile[] = (memberships ?? []).map((row: Record<string, unknown>) => {
    const profileData = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      user_id: row.user_id as string,
      role: row.role as WorkspaceMemberWithProfile["role"],
      created_at: row.created_at as string,
      profile: {
        id: profileData?.id ?? row.user_id,
        email: profileData?.email ?? null,
        full_name: profileData?.full_name ?? null,
        avatar_url: profileData?.avatar_url ?? null,
      },
    };
  });

  return NextResponse.json({ members });
}
