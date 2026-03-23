import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { buildWorkspaceSubjectExport } from "@/lib/privacy";
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
        { error: "Only workspace owners can export subject data." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const admin = createAdminClient();
    const payload = await buildWorkspaceSubjectExport(admin, {
      workspace: context.workspace,
      email:
        typeof body.email === "string" ? body.email.trim() : undefined,
      sessionId:
        typeof body.sessionId === "string" ? body.sessionId.trim() : undefined,
    });

    await createAuditLog(admin as never, {
      workspaceId: context.workspace.id,
      actorId: user.id,
      action: "privacy.dsar.export",
      summary: "Exported subject data for a widget privacy request.",
      metadata: {
        mode: payload.query.mode,
        query:
          payload.query.mode === "email"
            ? { email: payload.query.email?.replace(/(^.).*(@.*$)/, "$1***$2") }
            : { sessionId: payload.query.sessionId },
        summary: payload.summary,
      },
    });

    const slug = context.workspace.slug || "workspace";
    const identifier =
      payload.query.mode === "email"
        ? (payload.query.email ?? "subject").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()
        : payload.query.sessionId ?? "session";

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-privacy-export-${identifier}.json"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to export subject data.";
    const status =
      message.includes("Provide either an email or a session id") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
