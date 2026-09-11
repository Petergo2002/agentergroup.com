import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  FlywheelError,
  retryVerifiedFactKnowledgeProcessing,
  updateVerifiedFactAnswer,
} from "@/lib/flywheel/server";
import { createClient } from "@/lib/supabase/server";
import type { VerifiedFactVisibility } from "@/lib/types";
import { getVerifiedApiIdentity } from "@/lib/app/api-auth";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, session } = await getVerifiedApiIdentity(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const body = await request.json().catch(() => ({}));

    if (body.action === "retry_processing") {
      const result = await retryVerifiedFactKnowledgeProcessing(supabase as never, {
        workspaceId: context.workspace.id,
        userId: user.id,
        membershipRole: context.membership.role,
        verifiedFactId: id,
        accessToken: session?.access_token,
      });

      return NextResponse.json(result);
    }

    const fact = await updateVerifiedFactAnswer(supabase as never, {
      workspaceId: context.workspace.id,
      userId: user.id,
      membershipRole: context.membership.role,
      verifiedFactId: id,
      answer: String(body.answer ?? ""),
      visibility: parseVisibility(body.visibility),
      accessToken: session?.access_token,
    });

    return NextResponse.json({ fact });
  } catch (error) {
    return toErrorResponse(error);
  }
}
