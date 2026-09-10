import { NextResponse } from "next/server";
import {
  ensureWorkspaceContext,
  invalidateWorkspaceContextCache,
} from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
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

  if (
    targetWorkspace.membership.role !== "owner" &&
    targetWorkspace.membership.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Only workspace owners or admins can update workspace settings." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const descriptionValue = body.description;
  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
  }

  const updateResult = await supabase
    .from("workspaces")
    .update({
      name,
      description: description || null,
    })
    .eq("id", workspaceId)
    .select("id, name, slug, description, owner_id")
    .single();

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  invalidateWorkspaceContextCache(user.id, workspaceId);

  return NextResponse.json({
    workspace: updateResult.data,
  });
}

export async function DELETE(
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

  if (targetWorkspace.membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can delete a workspace." },
      { status: 403 },
    );
  }

  if (context.workspaces.length <= 1) {
    return NextResponse.json(
      { error: "You must keep at least one workspace." },
      { status: 400 },
    );
  }

  const nextWorkspace =
    context.workspaces.find((entry) => entry.workspace.id !== workspaceId) ?? null;

  const deleteResult = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  }

  if (!deleteResult.data) {
    return NextResponse.json(
      {
        error:
          "Workspace deletion was blocked. Verify the workspace still exists and that delete access is enabled.",
      },
      { status: 500 },
    );
  }

  invalidateWorkspaceContextCache(user.id, workspaceId);

  const response = NextResponse.json({
    deletedWorkspaceId: workspaceId,
    nextWorkspaceId: nextWorkspace?.workspace.id ?? null,
  });

  if (nextWorkspace) {
    response.cookies.set("active_workspace_id", nextWorkspace.workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    response.cookies.delete("active_workspace_id");
  }

  return response;
}
