import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId ?? "").trim();

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const selectedWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === workspaceId,
  );

  if (!selectedWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 403 });
  }

  const response = NextResponse.json({
    workspace: selectedWorkspace.workspace,
    membership: selectedWorkspace.membership,
  });

  response.cookies.set("active_workspace_id", selectedWorkspace.workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
