import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceAdminRole } from "@/lib/workspace-security";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  if (!isWorkspaceAdminRole(context.membership.role)) {
    return NextResponse.json(
      { error: "Only workspace owners or admins can revoke connection links." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("connection_auth_links")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Connection auth link not found or already closed." },
      { status: 404 },
    );
  }

  return NextResponse.json({ revoked: id });
}
