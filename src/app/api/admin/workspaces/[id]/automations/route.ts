import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/workspaces/[id]/automations
 * Toggles the automations_enabled feature flag for a workspace.
 * Requires admin access — only used from the internal admin panel.
 */
export async function PATCH(
  request: NextRequest,
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

  if (!(await isAdminUser(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled;

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from("workspaces")
    .update({
      automations_enabled: enabled,
    })
    .eq("id", id)
    .select("id, automations_enabled")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      automationsEnabled: workspace.automations_enabled === true,
    },
  });
}
