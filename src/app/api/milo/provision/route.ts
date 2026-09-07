import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  MiloProvisionError,
  provisionWorkspaceMilo,
} from "@/lib/milo/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await ensureWorkspaceContext(supabase as never, user);
  if (!['owner', 'admin'].includes(context.membership.role)) {
    return NextResponse.json(
      { error: "An owner or admin must finish Milo setup.", code: "milo_provision_unauthorized" },
      { status: 403 },
    );
  }

  try {
    const result = await provisionWorkspaceMilo({
      workspaceId: context.workspace.id,
      actorId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof MiloProvisionError ? error.code : "milo_provision_failed";
    const status = code === "milo_provision_ambiguous" ? 409 : code.endsWith("unauthorized") ? 403 : 500;
    console.error("Milo provisioning failed", { workspaceId: context.workspace.id, code });
    return NextResponse.json({ error: "Milo setup could not be completed.", code }, { status });
  }
}
