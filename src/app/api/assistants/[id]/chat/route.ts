import { NextRequest, NextResponse } from "next/server";
import {
  hasInternalAssistantsEnabled,
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
} from "@/lib/assistants/feature-flags";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  acquireAssistantThreadTurnLock,
  createAssistantThread,
  loadAssistantById,
  loadAssistantThread,
  releaseAssistantThreadTurnLock,
} from "@/lib/assistants/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import {
  completeRunStep,
  createAuditLog,
  createRunStep,
} from "@/lib/runtime/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MessageRecord } from "@/lib/types";

const THREAD_BUSY_ERROR =
  "Another reply is already being generated for this chat. Please wait for the current response to finish.";

interface PersistedAssistantMessage {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

function mapHistory(messages: MessageRecord[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    tool_call_id: message.tool_call_id,
    metadata: message.metadata,
  })) as Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
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

  const body = await request.json().catch(() => ({}));
  const input = String(body.message ?? "").trim();
  const providedThreadId = String(body.threadId ?? "").trim();

  if (!input) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

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
      { error: "This assistant is paused. Turn it back on before sending a message." },
      { status: 409 },
    );
  }

  const { data: draft } = await admin
    .from("agent_drafts")
    .select("definition")
    .eq("agent_id", assistant.id)
    .maybeSingle();

  const endChatPolicy = extractEndChatPolicyFromDefinition(
    draft?.definition ?? null,
  );
  const gmailRecipientPolicy = extractGmailRecipientPolicyFromDefinition(
    draft?.definition ?? null,
  );
  const googleCalendarSelection = extractGoogleCalendarSelectionFromDefinition(
    draft?.definition ?? null,
  );
  const calendarTimezone = googleCalendarSelection.timezone;

  const thread = providedThreadId
    ? await loadAssistantThread(admin as never, {
        threadId: providedThreadId,
        assistantId: assistant.id,
        workspaceId: assistant.workspace_id,
      })
    : await createAssistantThread(admin as never, {
        workspaceId: assistant.workspace_id,
        assistantId: assistant.id,
        actorUserId: user.id,
        title: input.slice(0, 48),
      });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const requestId = crypto.randomUUID();
  const turnLock = await acquireAssistantThreadTurnLock(
    admin as never,
    thread.id,
    requestId,
  );

  if (!turnLock.acquired) {
    return NextResponse.json(
      { error: THREAD_BUSY_ERROR, code: "THREAD_BUSY" },
      { status: 409 },
    );
  }

  let runId: string | null = null;

  try {
    const { data: run, error: runError } = await admin
      .from("runs")
      .insert({
        workspace_id: assistant.workspace_id,
        agent_id: assistant.id,
        thread_id: thread.id,
        status: "running",
        model: assistant.model,
        input: { message: input, source: "assistant" },
        created_by: user.id,
      })
      .select()
      .single();

    if (runError || !run) {
      throw runError ?? new Error("Failed to create run.");
    }

    runId = run.id;

    await createAuditLog(admin as never, {
      workspaceId: assistant.workspace_id,
      agentId: assistant.id,
      runId: run.id,
      actorId: user.id,
      action: "assistant.run.started",
      summary: "Started an internal assistant run.",
      metadata: {
        threadId: thread.id,
        model: assistant.model,
        source: "assistant",
      },
    });

    const persistUserStep = await createRunStep(admin as never, {
      runId: run.id,
      workspaceId: assistant.workspace_id,
      agentId: assistant.id,
      stepKey: "message.persist",
      stepType: "message",
      title: "Record user message",
      detail: "Persisting the incoming assistant message before runtime execution.",
    });

    const { error: userMessageError } = await admin.from("messages").insert({
      thread_id: thread.id,
      workspace_id: assistant.workspace_id,
      role: "user",
      content: input,
      created_by: user.id,
    });

    if (userMessageError) {
      await completeRunStep(
        admin as never,
        persistUserStep.id,
        "failed",
        userMessageError.message,
        { message: input },
      );
      throw new Error("Failed to record the message.");
    }

    await completeRunStep(
      admin as never,
      persistUserStep.id,
      "succeeded",
      "User message recorded.",
      { messageLength: input.length },
    );

    const historyStep = await createRunStep(admin as never, {
      runId: run.id,
      workspaceId: assistant.workspace_id,
      agentId: assistant.id,
      stepKey: "context.load",
      stepType: "context",
      title: "Load conversation context",
      detail: "Loading the assistant thread history.",
    });

    const { data: history, error: historyError } = await admin
      .from("messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (historyError) {
      throw historyError;
    }

    await completeRunStep(
      admin as never,
      historyStep.id,
      "succeeded",
      "Conversation history loaded.",
      { historyCount: history?.length ?? 0 },
    );

    const runtimeStep = await createRunStep(admin as never, {
      runId: run.id,
      workspaceId: assistant.workspace_id,
      agentId: assistant.id,
      stepKey: "runtime.execute",
      stepType: "model",
      title: "Run assistant runtime",
      detail: "Executing the shared runtime for internal assistant chat.",
      payload: {
        model: assistant.model,
      },
    });

    const result = await runAgentChat({
      supabase: admin as never,
      agent: assistant,
      input,
      history: mapHistory((history ?? []) as MessageRecord[]),
      toolUserId: buildWorkspaceComposioUserId(assistant.workspace_id),
      audience: "assistant",
      knowledgeAccessToken: session?.access_token ?? null,
      calendarTimezone,
      googleCalendarSelection,
      endChatPolicy,
      gmailRecipientPolicy,
    });

    await completeRunStep(
      admin as never,
      runtimeStep.id,
      "succeeded",
      "Shared runtime completed successfully.",
      {
        toolMessageCount: result.toolMessages.length,
        knowledgeMatchCount: result.knowledgeMatches.length,
      },
    );

    if (result.toolMessages.length > 0) {
      const { error: toolMessageError } = await admin.from("messages").insert(
        result.toolMessages.map((message) => ({
          thread_id: thread.id,
          workspace_id: assistant.workspace_id,
          role: "tool",
          content: String(message.content ?? ""),
          tool_name: message.name ?? null,
          tool_call_id: message.tool_call_id ?? null,
          metadata: message,
          created_by: user.id,
        })),
      );

      if (toolMessageError) {
        throw toolMessageError;
      }
    }

    const persistAssistantStep = await createRunStep(admin as never, {
      runId: run.id,
      workspaceId: assistant.workspace_id,
      agentId: assistant.id,
      stepKey: "message.assistant",
      stepType: "message",
      title: "Persist assistant response",
      detail: "Saving the final assistant response back to the thread.",
    });

    const { data: assistantMessage, error: assistantMessageError } = await admin
      .from("messages")
      .insert({
        thread_id: thread.id,
        workspace_id: assistant.workspace_id,
        role: "assistant",
        content: result.assistantContent,
        metadata: result.assistantMetadata,
        created_by: user.id,
      })
      .select()
      .single();

    if (assistantMessageError || !assistantMessage) {
      throw assistantMessageError ?? new Error("Failed to store assistant response.");
    }

    await completeRunStep(
      admin as never,
      persistAssistantStep.id,
      "succeeded",
      "Assistant message persisted.",
      { contentLength: result.assistantContent.length },
    );

    const nextThreadTitle =
      thread.title === "New chat" ? input.slice(0, 48) || assistant.name : thread.title;

    await Promise.all([
      admin
        .from("runs")
        .update({
          status: "succeeded",
          output: {
            finalCompletion: result.finalCompletion,
            toolMessages: result.toolMessages,
            knowledgeMatches: result.assistantMetadata.knowledgeMatches ?? [],
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id),
      admin
        .from("chat_threads")
        .update({
          title: nextThreadTitle,
        })
        .eq("id", thread.id),
      createAuditLog(admin as never, {
        workspaceId: assistant.workspace_id,
        agentId: assistant.id,
        runId: run.id,
        actorId: user.id,
        action: "assistant.run.succeeded",
        summary: "Completed an internal assistant run successfully.",
        metadata: {
          source: "assistant",
          connectedToolkits: result.connectedToolkits,
        },
      }),
    ]);

    return NextResponse.json({
      threadId: thread.id,
      runId: run.id,
      message: assistantMessage as PersistedAssistantMessage,
      toolMessages: result.toolMessages,
      sessionCompleted: false,
      endReason: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run assistant.";

    if (runId) {
      await Promise.all([
        admin
          .from("runs")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId),
        createAuditLog(admin as never, {
          workspaceId: assistant.workspace_id,
          agentId: assistant.id,
          runId,
          actorId: user.id,
          action: "assistant.run.failed",
          summary: "An internal assistant run failed.",
          metadata: {
            error: message,
            source: "assistant",
          },
        }),
      ]);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      await releaseAssistantThreadTurnLock(admin as never, thread.id, requestId);
    } catch (error) {
      console.error("Failed to release assistant thread lock:", error);
    }
  }
}
