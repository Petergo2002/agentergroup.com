import { NextResponse } from "next/server";
import { createWorkspaceForUser, ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  return NextResponse.json({
    activeWorkspaceId: context.workspace.id,
    workspaces: context.workspaces,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
  }

  const createdWorkspace = await createWorkspaceForUser(supabase as never, user, {
    name,
    description,
  });

  const response = NextResponse.json({
    workspace: createdWorkspace.workspace,
    membership: createdWorkspace.membership,
  });

  response.cookies.set("active_workspace_id", createdWorkspace.workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
