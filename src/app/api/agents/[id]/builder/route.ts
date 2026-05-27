import { NextRequest, NextResponse } from "next/server";
import { loadAgentBuilderBootstrap } from "@/lib/agents/builder-bootstrap";
import { createClient } from "@/lib/supabase/server";

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

  try {
    return NextResponse.json(
      await loadAgentBuilderBootstrap(supabase, user, agentId),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load builder data.",
      },
      { status: 500 },
    );
  }
}
