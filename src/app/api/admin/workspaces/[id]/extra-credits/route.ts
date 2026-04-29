import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_CREDIT_AMOUNTS = new Set([50, 100, 500]);

interface ExtraCreditsRpcRow {
  workspace_id: string;
  messages_limit: number;
  messages_used: number;
  granted_amount: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminUser(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const amount = body.amount;

  if (!Number.isInteger(amount) || !VALID_CREDIT_AMOUNTS.has(amount)) {
    return NextResponse.json(
      { error: "amount must be one of: 50, 100, 500." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_workspace_extra_messages", {
    p_workspace_id: workspaceId,
    p_actor_id: user.id,
    p_amount: amount,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : 500;
    const message =
      error.code === "P0002"
        ? "Workspace subscription not found."
        : error.message;

    return NextResponse.json({ error: message }, { status });
  }

  const grant = Array.isArray(data)
    ? (data[0] as ExtraCreditsRpcRow | undefined)
    : undefined;

  if (!grant) {
    return NextResponse.json(
      { error: "Workspace subscription not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    subscription: {
      workspaceId: grant.workspace_id,
      messagesLimit: grant.messages_limit,
      messagesUsed: grant.messages_used,
    },
    grantedAmount: grant.granted_amount,
  });
}
