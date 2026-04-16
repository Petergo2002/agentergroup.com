import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** DELETE /api/workspaces/[id]/members/[memberId] — Remove a member from the workspace. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: workspaceId, memberId } = await params;
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

  // Look up the member to be removed
  const { data: targetMember, error: lookupError } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .single();

  if (lookupError || !targetMember) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const actorRole = targetWorkspace.membership.role;
  const isSelf = targetMember.user_id === user.id;

  // Cannot remove the workspace owner
  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "The workspace owner cannot be removed." },
      { status: 403 },
    );
  }

  // Must be owner/admin to remove others, or removing yourself
  if (!isSelf && actorRole !== "owner" && actorRole !== "admin") {
    return NextResponse.json(
      { error: "Only workspace owners or admins can remove members." },
      { status: 403 },
    );
  }

  // Use the admin client for the actual delete to bypass PostgreSQL RLS recursion
  // (We've already verified permission via ensureWorkspaceContext + role checks above)
  const adminClient = createAdminClient();
  const { error: deleteError } = await adminClient
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ removed: memberId });
}
