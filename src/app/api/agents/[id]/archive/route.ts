import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/runtime/observability";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const archived = Boolean(body.archived);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? user.id : null,
    })
    .eq("id", agentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await createAuditLog(supabase, {
    workspaceId: agent.workspace_id,
    agentId: agent.id,
    actorId: user.id,
    action: archived ? "agent.archived" : "agent.restored",
    summary: archived ? "Archived an agent." : "Restored an archived agent.",
  });

  return NextResponse.json({ ok: true });
}
