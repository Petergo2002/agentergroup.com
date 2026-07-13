import { NextResponse } from "next/server";
import {
  hasInternalAssistantsEnabled,
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
} from "@/lib/assistants/feature-flags";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { listWorkspaceAssistants } from "@/lib/assistants/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);

    if (!hasInternalAssistantsEnabled(context.workspace)) {
      return NextResponse.json(
        {
          error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
          code: INTERNAL_ASSISTANTS_DISABLED_CODE,
        },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const assistants = await listWorkspaceAssistants(admin as never, {
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      membershipRole: context.membership.role,
    });

    return NextResponse.json({ assistants });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load assistants.",
      },
      { status: 500 },
    );
  }
}
