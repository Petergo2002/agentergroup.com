import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  FlywheelError,
  getFlywheelQuestionDetail,
  updateUnansweredQueryDisposition,
} from "@/lib/flywheel/server";
import { createClient } from "@/lib/supabase/server";

function toErrorResponse(error: unknown) {
  if (error instanceof FlywheelError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    { status: 500 },
  );
}

export async function GET(
  _request: NextRequest,
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

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const question = await getFlywheelQuestionDetail(supabase as never, {
      workspaceId: context.workspace.id,
      queryId: id,
    });

    return NextResponse.json({ question });
  } catch (error) {
    return toErrorResponse(error);
  }
}

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

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (!["dismiss", "reopen", "mark_duplicate"].includes(action)) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const question = await updateUnansweredQueryDisposition(supabase as never, {
      workspaceId: context.workspace.id,
      userId: user.id,
      membershipRole: context.membership.role,
      queryId: id,
      action: action as "dismiss" | "reopen" | "mark_duplicate",
      duplicateOf: typeof body.duplicateOf === "string" ? body.duplicateOf : null,
    });

    return NextResponse.json({ question });
  } catch (error) {
    return toErrorResponse(error);
  }
}
