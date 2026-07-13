import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  countFlywheelQuestions,
  FlywheelError,
  listFlywheelQuestions,
} from "@/lib/flywheel/server";
import { createClient } from "@/lib/supabase/server";
import type { UnansweredQueryStatus } from "@/lib/types";

function toErrorResponse(error: unknown) {
  if (error instanceof FlywheelError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    { status: 500 },
  );
}

function parseStatus(value: string | null): UnansweredQueryStatus | "all" | undefined {
  if (!value) {
    return undefined;
  }

  if (["open", "answered", "dismissed", "duplicate", "all"].includes(value)) {
    return value as UnansweredQueryStatus | "all";
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const searchParams = request.nextUrl.searchParams;
    const input = {
      workspaceId: context.workspace.id,
      status: parseStatus(searchParams.get("status")),
      agentId: searchParams.get("agentId"),
      widgetId: searchParams.get("widgetId"),
      limit: Number(searchParams.get("limit") ?? 100),
    };
    const [questions, counts] = await Promise.all([
      listFlywheelQuestions(supabase as never, input),
      countFlywheelQuestions(supabase as never, {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        widgetId: input.widgetId,
      }),
    ]);

    return NextResponse.json({ questions, counts });
  } catch (error) {
    return toErrorResponse(error);
  }
}
