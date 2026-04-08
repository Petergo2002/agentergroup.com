import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getDashboardConversationDetail } from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ widgetSessionId: string }> },
) {
  const { widgetSessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const admin = createAdminClient();
    const detail = await getDashboardConversationDetail(admin, {
      workspaceId: context.workspace.id,
      widgetSessionId,
      viewerRole: context.membership.role,
    });

    if (!detail) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversation detail.",
      },
      { status: 500 },
    );
  }
}
