import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { deleteWorkspaceSubjectData, lookupWorkspaceSubjectData } from "@/lib/privacy";
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
        { error: "Only workspace owners can delete subject data." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirmation =
      typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    const requestReference =
      typeof body.requestReference === "string"
        ? body.requestReference.trim()
        : "";

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: 'Confirmation must be exactly "DELETE".' },
        { status: 400 },
      );
    }

    if (!requestReference) {
      return NextResponse.json(
        { error: "requestReference is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const lookup = await lookupWorkspaceSubjectData(admin, {
      workspaceId: context.workspace.id,
      email:
        typeof body.email === "string" ? body.email.trim() : undefined,
      sessionId:
        typeof body.sessionId === "string" ? body.sessionId.trim() : undefined,
    });

    const deleted = await deleteWorkspaceSubjectData(admin, {
      workspaceId: context.workspace.id,
      email: lookup.query.mode === "email" ? lookup.query.email : undefined,
      sessionId:
        lookup.query.mode === "sessionId" ? lookup.query.sessionId : undefined,
      includeTranscriptMatches: body.includeTranscriptMatches === true,
    });

    await createAuditLog(admin as never, {
      workspaceId: context.workspace.id,
      actorId: user.id,
      action: "privacy.dsar.delete",
      summary: "Deleted subject data for a widget privacy request.",
      metadata: {
        mode: lookup.query.mode,
        includeTranscriptMatches: body.includeTranscriptMatches === true,
        requestReference,
        deleted,
        query:
          lookup.query.mode === "email"
            ? { email: lookup.query.email?.replace(/(^.).*(@.*$)/, "$1***$2") }
            : { sessionId: lookup.query.sessionId },
      },
    });

    return NextResponse.json({
      ok: true,
      deleted,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete subject data.";
    const status =
      message.includes("Provide either an email or a session id") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
