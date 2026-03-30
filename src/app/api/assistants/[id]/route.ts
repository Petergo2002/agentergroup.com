import { NextRequest, NextResponse } from "next/server";
import {
  hasInternalAssistantsEnabled,
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
} from "@/lib/assistants/feature-flags";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import {
  loadAssistantById,
  loadAssistantMessages,
  loadAssistantThread,
  loadAssistantThreads,
} from "@/lib/assistants/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

    if (!assistant || assistant.archived_at) {
      return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
    }

    if (assistant.status === "draft") {
      return NextResponse.json({ error: "Assistant is not ready yet." }, { status: 404 });
    }

    const membershipRole = getMembershipRoleForWorkspace(
      context.workspaces,
      assistant.workspace_id,
    );
    const canEdit = canEditAgentRecord(assistant, user.id, membershipRole);
    const threads = await loadAssistantThreads(admin as never, assistant);
    const requestedThreadId = request.nextUrl.searchParams.get("threadId")?.trim() ?? null;
    const resolvedThreadId = requestedThreadId || threads[0]?.id || null;

    if (requestedThreadId) {
      const thread = await loadAssistantThread(admin as never, {
        threadId: requestedThreadId,
        assistantId: assistant.id,
        workspaceId: assistant.workspace_id,
      });

      if (!thread) {
        return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      }
    }

    const messages = resolvedThreadId
      ? await loadAssistantMessages(admin as never, {
          threadId: resolvedThreadId,
          assistantName: assistant.name,
        })
      : [];

    return NextResponse.json({
      assistant,
      canEdit,
      threads,
      activeThreadId: resolvedThreadId,
      messages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load assistant.",
      },
      { status: 500 },
    );
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

    const body = await request.json().catch(() => ({}));
    const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!threadId || !title) {
      return NextResponse.json(
        { error: "Thread id and title are required." },
        { status: 400 },
      );
    }

    const thread = await loadAssistantThread(admin as never, {
      threadId,
      assistantId: assistant.id,
      workspaceId: assistant.workspace_id,
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    const { data: updatedThread, error: updateError } = await admin
      .from("chat_threads")
      .update({
        title: title.slice(0, 120),
      })
      .eq("id", thread.id)
      .eq("workspace_id", assistant.workspace_id)
      .eq("agent_id", assistant.id)
      .eq("source", "assistant")
      .select("*")
      .single();

    if (updateError || !updatedThread) {
      throw updateError ?? new Error("Failed to rename chat.");
    }

    return NextResponse.json({
      thread: {
        id: updatedThread.id,
        title: updatedThread.title,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to rename chat.",
      },
      { status: 500 },
    );
  }
}
