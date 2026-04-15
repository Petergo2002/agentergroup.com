import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord } from "@/lib/agents/access";
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
    .select("id, surface")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent as never, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
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
    .select("id, workspace_id, surface, created_by")
    .eq("id", agentId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent as never, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  if (!canEditAgentRecord(agent as never, user.id, context.membership.role)) {
    return NextResponse.json(
      { error: "You do not have permission to edit this agent." },
      { status: 403 },
    );
  }

  let finalSourceIdsToInsert: string[] = sourceIds;

  if (sourceIds.length > 0) {
    const { data: validSources, error: validSourcesError } = await supabase
      .from("knowledge_sources")
      .select("id")
      .eq("workspace_id", context.workspace.id)
      .in("id", sourceIds);

    if (validSourcesError) {
      return NextResponse.json({ error: validSourcesError.message }, { status: 500 });
    }

    finalSourceIdsToInsert = (validSources ?? []).map((s) => s.id);
  }

  const { error: deleteError } = await supabase
    .from("agent_knowledge_sources")
    .delete()
    .eq("agent_id", agentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (finalSourceIdsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("agent_knowledge_sources").insert(
      finalSourceIdsToInsert.map((sourceId) => ({
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
