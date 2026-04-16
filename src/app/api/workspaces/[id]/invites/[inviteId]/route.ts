import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

/** DELETE /api/workspaces/[id]/invites/[inviteId] — Revoke a pending invite. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const { id: workspaceId, inviteId } = await params;
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

  const role = targetWorkspace.membership.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Only workspace owners or admins can revoke invites." },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ revoked: inviteId });
}
