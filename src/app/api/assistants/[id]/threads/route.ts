import { NextRequest, NextResponse } from "next/server";
import {
  hasInternalAssistantsEnabled,
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
} from "@/lib/assistants/feature-flags";
import { loadAssistantById, createAssistantThread } from "@/lib/assistants/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    const assistant = await loadAssistantById(admin as never, id, context.workspace.id);

    if (!assistant || assistant.archived_at || assistant.status === "draft") {
      return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
    }

    if (assistant.status === "paused") {
      return NextResponse.json(
        { error: "This assistant is paused. Turn it back on before starting a new chat." },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "New chat";
    const thread = await createAssistantThread(admin as never, {
      workspaceId: assistant.workspace_id,
      assistantId: assistant.id,
      actorUserId: user.id,
      title,
    });

    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        source: thread.source,
        createdBy: thread.created_by,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        messageCount: 0,
        lastMessageAt: null,
        lastMessageSnippet: null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create a new chat.",
      },
      { status: 500 },
    );
  }
}
