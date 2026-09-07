import { NextResponse } from "next/server";
import {
  createWorkspaceForUser,
  ensureWorkspaceContext,
  invalidateWorkspaceContextCache,
} from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import {
  canCreateWorkspace,
  getOwnedWorkspaceCount,
  getWorkspaceLimitForPlan,
} from "@/lib/workspace-limits";

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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const ownedWorkspaceCount = getOwnedWorkspaceCount(context.workspaces);
  const workspaceLimit = getWorkspaceLimitForPlan(context.subscription?.plan_tier);

  if (
    !canCreateWorkspace({
      plan: context.subscription?.plan_tier,
      ownedWorkspaceCount,
    })
  ) {
    return NextResponse.json(
      {
        error:
          context.subscription?.plan_tier === "premium"
            ? `Your Premium plan allows up to ${workspaceLimit} workspaces.`
            : "Upgrade to Premium to create more workspaces.",
        code: "workspace_limit_reached",
        workspaceLimit,
        ownedWorkspaceCount,
      },
      { status: 403 },
    );
  }

  const createdWorkspace = await createWorkspaceForUser(supabase as never, user, {
    name,
    description,
  });

  invalidateWorkspaceContextCache(user.id);

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
