import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import type { KnowledgeSourceRecord } from "@/lib/types";

interface AgentKnowledgeJoinRow {
  source: KnowledgeSourceRecord | KnowledgeSourceRecord[] | null;
}

export async function GET(
  _request: NextRequest,
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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("agent_knowledge_sources")
    .select("source:knowledge_sources(*)")
    .eq("agent_id", agentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sources = ((data ?? []) as unknown as AgentKnowledgeJoinRow[])
    .map((item) => (Array.isArray(item.source) ? item.source[0] ?? null : item.source))
    .filter(Boolean) as KnowledgeSourceRecord[];

  return NextResponse.json({
    sources,
  });
}

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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const sourceIds: string[] = Array.isArray(body.sourceIds)
    ? body.sourceIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, workspace_id")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (sourceIds.length > 0) {
    const { data: validSources, error: validSourcesError } = await supabase
      .from("knowledge_sources")
      .select("id")
      .eq("workspace_id", context.workspace.id)
      .in("id", sourceIds);

    if (validSourcesError) {
      return NextResponse.json({ error: validSourcesError.message }, { status: 500 });
    }

    if ((validSources ?? []).length !== sourceIds.length) {
      return NextResponse.json(
        { error: "One or more knowledge sources are invalid for this workspace." },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("agent_knowledge_sources")
    .delete()
    .eq("agent_id", agentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (sourceIds.length > 0) {
    const { error: insertError } = await supabase.from("agent_knowledge_sources").insert(
      sourceIds.map((sourceId) => ({
        agent_id: agentId,
        knowledge_source_id: sourceId,
      })),
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
