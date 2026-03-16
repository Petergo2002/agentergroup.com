import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/runtime/observability";
import type { BuilderDefinition } from "@/lib/types";

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
  const versionId = String(body.versionId ?? "").trim();

  if (!versionId) {
    return NextResponse.json({ error: "versionId is required." }, { status: 400 });
  }

  const [{ data: agent, error: agentError }, { data: version, error: versionError }, { data: draft }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", agentId).single(),
      supabase
        .from("agent_versions")
        .select("*")
        .eq("id", versionId)
        .eq("agent_id", agentId)
        .single(),
      supabase.from("agent_drafts").select("version").eq("agent_id", agentId).maybeSingle(),
    ]);

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (versionError || !version) {
    return NextResponse.json({ error: "Version not found." }, { status: 404 });
  }

  const definition = version.definition as BuilderDefinition;

  const { error: updateAgentError } = await supabase
    .from("agents")
    .update({
      model: definition.config?.model ?? agent.model,
      instructions: definition.config?.instructions ?? agent.instructions,
      starter_prompts: definition.config?.starterPrompts ?? agent.starter_prompts,
      published_version_id: version.id,
      status: "active",
    })
    .eq("id", agentId);

  if (updateAgentError) {
    return NextResponse.json({ error: updateAgentError.message }, { status: 500 });
  }

  const { error: draftError } = await supabase.from("agent_drafts").upsert(
    {
      agent_id: agentId,
      workspace_id: agent.workspace_id,
      updated_by: user.id,
      definition,
      version: (draft?.version ?? version.version) + 1,
    },
    {
      onConflict: "agent_id",
    },
  );

  if (draftError) {
    return NextResponse.json({ error: draftError.message }, { status: 500 });
  }

  await createAuditLog(supabase, {
    workspaceId: agent.workspace_id,
    agentId: agent.id,
    actorId: user.id,
    action: "agent.rollback",
    summary: `Rolled back the agent to version ${version.version}.`,
    metadata: {
      versionId: version.id,
      version: version.version,
    },
  });

  return NextResponse.json({ ok: true });
}
