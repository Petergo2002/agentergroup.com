import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  FlywheelError,
  publishVerifiedAnswer,
} from "@/lib/flywheel/server";
import { createClient } from "@/lib/supabase/server";
import type { VerifiedFactVisibility } from "@/lib/types";

function toErrorResponse(error: unknown) {
  if (error instanceof FlywheelError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    { status: 500 },
  );
}

function parseVisibility(value: unknown): VerifiedFactVisibility {
  return value === "public_ready" ? "public_ready" : "agent_only";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const body = await request.json().catch(() => ({}));
    const result = await publishVerifiedAnswer(supabase as never, {
      workspaceId: context.workspace.id,
      userId: user.id,
      membershipRole: context.membership.role,
      queryId: id,
      answer: String(body.answer ?? ""),
      visibility: parseVisibility(body.visibility),
      accessToken: session?.access_token,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
