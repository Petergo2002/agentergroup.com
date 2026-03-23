import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  lookupWorkspaceSubjectData,
  summarizePrivacyLookupForAudit,
} from "@/lib/privacy";
import { createAuditLog } from "@/lib/runtime/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);

    if (context.workspace.id !== workspaceId) {
      return NextResponse.json(
        { error: "Privacy actions must target the active workspace." },
        { status: 403 },
      );
    }

    if (context.membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only workspace owners can access privacy tools." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const admin = createAdminClient();
    const lookup = await lookupWorkspaceSubjectData(admin, {
      workspaceId: context.workspace.id,
      email:
        typeof body.email === "string" ? body.email.trim() : undefined,
      sessionId:
        typeof body.sessionId === "string" ? body.sessionId.trim() : undefined,
    });

    await createAuditLog(admin as never, {
      workspaceId: context.workspace.id,
      actorId: user.id,
      action: "privacy.dsar.lookup",
      summary: "Previewed subject data for a widget privacy request.",
      metadata: summarizePrivacyLookupForAudit(lookup),
    });

    return NextResponse.json(lookup);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to preview subject data.";
    const status =
      message.includes("Provide either an email or a session id") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
