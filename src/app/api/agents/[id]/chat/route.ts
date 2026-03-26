import { NextRequest, NextResponse } from "next/server";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import {
  completeRunStep,
  createAuditLog,
  createRunStep,
} from "@/lib/runtime/observability";
import type { MessageRecord } from "@/lib/types";

interface PersistedAssistantMessage {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface PreviewThreadRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  created_by: string;
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
  const { id: agentId } = await params;
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

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from("agent_drafts")
    .select("definition")
    .eq("agent_id", agentId)
    .single();

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

  let threadId = providedThreadId;

  if (threadId) {
    const { data: existingThread, error: threadLookupError } = await supabase
      .from("chat_threads")
      .select("id, workspace_id, agent_id, created_by")
      .eq("id", threadId)
      .eq("workspace_id", agent.workspace_id)
      .eq("agent_id", agent.id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (threadLookupError) {
      return NextResponse.json(
        { error: "Failed to load the preview thread." },
        { status: 500 },
      );
    }

    const previewThread = existingThread as PreviewThreadRecord | null;

    if (!previewThread) {
      return NextResponse.json(
        { error: "Preview thread not found for this agent." },
        { status: 404 },
      );
    }
  } else {
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .insert({
        workspace_id: agent.workspace_id,
        agent_id: agent.id,
        created_by: user.id,
        title: input.slice(0, 48),
      })
      .select()
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: "Failed to create thread." }, { status: 500 });
    }

    threadId = thread.id;
  }

  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      workspace_id: agent.workspace_id,
      agent_id: agent.id,
      thread_id: threadId,
      status: "running",
      model: agent.model,
      input: { message: input, source: "preview" },
      created_by: user.id,
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "Failed to create run." }, { status: 500 });
  }

  await createAuditLog(supabase, {
    workspaceId: agent.workspace_id,
    agentId: agent.id,
    runId: run.id,
    actorId: user.id,
    action: "run.started",
    summary: "Started a conversational run.",
    metadata: {
      threadId,
      model: agent.model,
      source: "preview",
    },
  });

  const persistUserStep = await createRunStep(supabase, {
    runId: run.id,
    workspaceId: agent.workspace_id,
    agentId: agent.id,
    stepKey: "message.persist",
    stepType: "message",
    title: "Record user message",
    detail: "Persisting the incoming user message before runtime execution.",
  });

  const { error: userMessageError } = await supabase.from("messages").insert({
    thread_id: threadId,
    workspace_id: agent.workspace_id,
    role: "user",
    content: input,
    created_by: user.id,
  });

  if (userMessageError) {
    await completeRunStep(
      supabase,
      persistUserStep.id,
      "failed",
      userMessageError.message,
      { message: input },
    );
    return NextResponse.json({ error: "Failed to record the message." }, { status: 500 });
  }

  await completeRunStep(
    supabase,
    persistUserStep.id,
    "succeeded",
    "User message recorded.",
    { messageLength: input.length },
  );

  try {
    const historyStep = await createRunStep(supabase, {
      runId: run.id,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "context.load",
      stepType: "context",
      title: "Load conversation context",
      detail: "Loading existing preview thread history.",
    });

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (historyError) {
      throw historyError;
    }

    await completeRunStep(
      supabase,
      historyStep.id,
      "succeeded",
      "Conversation history loaded.",
      { historyCount: history?.length ?? 0 },
    );

    const runtimeStep = await createRunStep(supabase, {
      runId: run.id,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "runtime.execute",
      stepType: "model",
      title: "Run agent runtime",
      detail: "Executing the shared agent runtime for preview chat.",
      payload: {
        model: agent.model,
      },
    });

    const result = await runAgentChat({
      supabase: supabase as never,
      agent,
      input,
      history: mapHistory((history ?? []) as MessageRecord[]),
      toolUserId: buildWorkspaceComposioUserId(agent.workspace_id, user.id),
      audience: "preview",
      knowledgeAccessToken: session?.access_token ?? null,
      calendarTimezone,
      googleCalendarSelection,
      endChatPolicy,
      gmailRecipientPolicy,
    });

    await completeRunStep(
      supabase,
      runtimeStep.id,
      "succeeded",
      "Shared runtime completed successfully.",
      {
        toolMessageCount: result.toolMessages.length,
        knowledgeMatchCount: result.knowledgeMatches.length,
      },
    );

    if (result.toolMessages.length > 0) {
      await supabase.from("messages").insert(
        result.toolMessages.map((message) => ({
          thread_id: threadId,
          workspace_id: agent.workspace_id,
          role: "tool",
          content: String(message.content ?? ""),
          tool_name: message.name ?? null,
          tool_call_id: message.tool_call_id ?? null,
          metadata: message,
          created_by: user.id,
        })),
      );
    }

    const persistAssistantStep = await createRunStep(supabase, {
      runId: run.id,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "message.assistant",
      stepType: "message",
      title: "Persist assistant response",
      detail: "Saving the final assistant message back to the thread.",
    });

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        workspace_id: agent.workspace_id,
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
      supabase,
      persistAssistantStep.id,
      "succeeded",
      "Assistant message persisted.",
      { contentLength: result.assistantContent.length },
    );

    await Promise.all([
      supabase
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
      supabase
        .from("chat_threads")
        .update({
          title: agent.name,
        })
        .eq("id", threadId),
      createAuditLog(supabase, {
        workspaceId: agent.workspace_id,
        agentId: agent.id,
        runId: run.id,
        actorId: user.id,
        action: "run.succeeded",
        summary: "Completed a conversational run successfully.",
        metadata: {
          source: "preview",
          connectedToolkits: result.connectedToolkits,
        },
      }),
    ]);

    return NextResponse.json({
      threadId,
      runId: run.id,
      message: assistantMessage as PersistedAssistantMessage,
      toolMessages: result.toolMessages,
      sessionCompleted: Boolean(result.endChat?.sessionCompleted),
      endReason: result.endChat?.reason ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run agent.";

    await Promise.all([
      supabase
        .from("runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id),
      createAuditLog(supabase, {
        workspaceId: agent.workspace_id,
        agentId: agent.id,
        runId: run.id,
        actorId: user.id,
        action: "run.failed",
        summary: "A conversational run failed.",
        metadata: {
          error: message,
          source: "preview",
        },
      }),
    ]);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
