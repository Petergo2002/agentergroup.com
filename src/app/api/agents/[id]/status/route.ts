import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";

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
  const status = body.status === "active" ? "active" : body.status === "paused" ? "paused" : null;

  if (!status) {
    return NextResponse.json({ error: "Invalid agent status." }, { status: 400 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (agent.archived_at) {
    return NextResponse.json(
      { error: "Restore the agent before changing its status." },
      { status: 400 },
    );
  }

  if (status === "active" && !agent.published_version_id) {
    return NextResponse.json(
      { error: "Publish the agent before turning it on." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update({ status })
    .eq("id", agentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await createAuditLog(supabase, {
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      actorId: user.id,
      action: status === "active" ? "agent.activated" : "agent.paused",
      summary: status === "active" ? "Turned an agent on." : "Turned an agent off.",
    });
  } catch (error) {
    console.error("Failed to write agent status audit log", error);
  }

  return NextResponse.json({ ok: true, status });
}
