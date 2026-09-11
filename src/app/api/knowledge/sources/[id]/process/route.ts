import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { knowledgeProcessingError } from "@/lib/knowledge-processing-error";
import { getVerifiedApiIdentity } from "@/lib/app/api-auth";

export const maxDuration = 150;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, session } = await getVerifiedApiIdentity(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("id, workspace_id")
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (error || !source) {
    return NextResponse.json({ error: "Knowledge source not found." }, { status: 404 });
  }

  const result = await supabase.functions.invoke("process-knowledge-source", {
    headers: session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : undefined,
    body: {
      sourceId: source.id,
    },
  });

  if (result.error) {
    const { data: failedSource } = await supabase
      .from("knowledge_sources")
      .select("error_message, status")
      .eq("id", source.id)
      .maybeSingle();

    return NextResponse.json(
      {
        error: (await knowledgeProcessingError(result.error, failedSource?.error_message)).message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.data?.status ?? "processing",
  });
}
